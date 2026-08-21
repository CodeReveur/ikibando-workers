"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MotariMap, type MapPoint, type ExtraPoint } from "@/components/motari/MotariMap";
import { getRoute, fmtDistance, fmtDuration, type RouteResult } from "@/lib/routing";
import {
  getMotariState, getMotariHistory, saveMotariProfile, setMotariOnline, motariHeartbeat,
  acceptRide, declineRide, motariArrived, motariStart, motariComplete, motariPaid, motariCancelRide,
  requestWithdrawalOtp, confirmWithdrawal, submitContact, apiError,
  type MotariState, type MotariHistory, type RideDto,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { playSound, startSoundLoop, stopSoundLoop, unlockSounds } from "@/lib/sounds";
import {
  Bike, Phone, Power, Banknote, Smartphone, CheckCircle2, X, Star, LogOut, ChevronDown, ChevronUp, Globe,
} from "lucide-react";

const POLL_MS = 5000;
const HEARTBEAT_MS = 4000;

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const km = (m?: number) => `${((m ?? 0) / 1000).toFixed(1)} km`;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

type Tab = "rides" | "money" | "trips" | "more";

/**
 * The motari's whole working day on one screen, styled like the passenger app:
 * the map behind, a minimizable sheet in front. Go online, watch passengers
 * seeking rides appear as pins, accept, run the ride, collect, withdraw, review
 * trips, raise a complaint. The session persists until an explicit logout.
 */
export default function MotariDrivePage() {
  const { t, language, setLanguage } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);

  const [state, setState] = useState<MotariState | null>(null);
  const [history, setHistory] = useState<MotariHistory | null>(null);
  const [tab, setTab] = useState<Tab>("rides");
  const [minimized, setMinimized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  // GPS position as STATE so the map marker re-renders and moves with every fix
  // (a ref alone updates silently and the marker appears frozen or missing).
  const [myPos, setMyPos] = useState<MapPoint | null>(null);
  const [gpsAcc, setGpsAcc] = useState<number | null>(null);

  // Local 1s countdown for the dispatch offer; the server clock is authoritative
  // and re-syncs it on every poll/heartbeat.
  const [offerLeft, setOfferLeft] = useState(0);
  const offerId = state?.offer?.rideId;
  useEffect(() => {
    if (!state?.offer) { setOfferLeft(0); return; }
    setOfferLeft(Math.ceil(state.offer.expiresInSeconds));
    const id = setInterval(() => setOfferLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerId, state?.offer?.expiresInSeconds]);

  // profile form (only when the account has no moto yet)
  const [legalName, setLegalName] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");

  // withdrawal
  const [wAmount, setWAmount] = useState("");
  const [wPhone, setWPhone] = useState("");
  const [wProvider, setWProvider] = useState<"MTN_MOMO" | "AIRTEL_MONEY">("MTN_MOMO");
  const [wStep, setWStep] = useState<"FORM" | "CODE" | "DONE">("FORM");
  const [wCode, setWCode] = useState("");
  const [wMsg, setWMsg] = useState("");

  // complaint
  const [complaint, setComplaint] = useState("");
  const [complaintSent, setComplaintSent] = useState(false);

  const token = () => localStorage.getItem("access_token") ?? "";

  /* ── notification sounds ───────────────────────────────────────────────── */
  useEffect(() => {
    const once = () => unlockSounds();
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, []);

  // The offer keeps ringing for its whole window, like a phone call, and stops
  // the moment it is accepted, passed, or expires.
  const prevRideStatus = useRef<string | null>(null);
  const prevPaidStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const active = state?.activeRide;
    const before = prevRideStatus.current;
    if (!active && before && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(before)) {
      // The ride left this driver: the passenger cancelled or it was handed back.
      playSound("payment-arrived-canceled");
    }
    if (prevPaidStatus.current !== "PAID" && active?.paymentStatus === "PAID") {
      playSound("payment-arrived-canceled");
    }
    prevRideStatus.current = active?.status ?? null;
    prevPaidStatus.current = active?.paymentStatus;
  }, [state?.activeRide?.status, state?.activeRide?.paymentStatus, state]);

  // Ring while an offer is live and its countdown still has time; silence it as
  // soon as the card goes away for any reason, including leaving the page.
  const ringing = !!state?.offer && !state?.activeRide && offerLeft > 0;
  useEffect(() => {
    if (ringing) startSoundLoop("incoming-ride");
    else stopSoundLoop("incoming-ride");
  }, [ringing]);
  useEffect(() => () => stopSoundLoop("incoming-ride"), []);

  /* ── session: present until logout; a dead session goes to sign in ──────── */
  useEffect(() => {
    if (!localStorage.getItem("access_token")) { window.location.href = "/signin"; return; }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await getMotariState(token()));
      setError("");
    } catch (e) {
      // The axios layer already retried with the refresh token; only a truly
      // dead session (or server outage) lands here. Stay put, show the error.
      setError(apiError(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    getMotariHistory(token()).then(setHistory).catch(() => {});
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // refresh money/trips numbers when those tabs open or a ride closes
  useEffect(() => {
    if (tab === "money" || tab === "trips") {
      getMotariHistory(token()).then(setHistory).catch(() => {});
    }
  }, [tab, state?.activeRide?.status]);

  /* ── GPS: always watched, so the map shows the exact device position and
        auto-refreshes as it moves — online or not. ──────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(t("motari.dash.gps_off") || "Enable location to receive rides.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      p => {
        // Kilometre-scale accuracy is an IP guess, not a GPS fix: don't draw it.
        if (p.coords.accuracy != null && p.coords.accuracy > 5000) return;
        posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMyPos({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setGpsAcc(p.coords.accuracy ?? null);
        setGpsError("");
      },
      () => setGpsError(t("motari.dash.gps_off") || "Enable location to receive rides."),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [t]);

  /* ── Heartbeat to the platform only while online ────────────────────────── */
  const online = !!state?.profile?.online;
  useEffect(() => {
    if (!online) return;
    const beat = setInterval(() => {
      const pos = posRef.current;
      if (pos) motariHeartbeat(pos.lat, pos.lng, token()).then(setState).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [online]);

  const act = async (fn: () => Promise<MotariState>) => {
    setBusy(true);
    setError("");
    try { setState(await fn()); } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.location.href = "/motari";
  };

  const withdraw = async () => {
    const amount = parseInt(wAmount, 10);
    if (!amount || amount < 500 || wPhone.replace(/\D/g, "").length < 9) return;
    setBusy(true);
    setWMsg("");
    try {
      await requestWithdrawalOtp({ amount, phoneNumber: wPhone.trim(), paymentMethod: wProvider }, token());
      setWStep("CODE");
      setWMsg(t("motari.dash.w_code_sent") || "Check your email for the 6 digit code.");
    } catch (e) { setWMsg(apiError(e)); }
    setBusy(false);
  };

  const confirmW = async () => {
    if (wCode.trim().length < 4) return;
    setBusy(true);
    setWMsg("");
    try {
      await confirmWithdrawal(wCode.trim(), token());
      setWStep("DONE");
      setWMsg(t("motari.dash.w_done") || "Withdrawal sent to your phone.");
      getMotariHistory(token()).then(setHistory).catch(() => {});
    } catch (e) { setWMsg(apiError(e)); }
    setBusy(false);
  };

  const sendComplaint = async () => {
    if (complaint.trim().length < 10) return;
    setBusy(true);
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      await submitContact({
        name: u.name || "Motari",
        email: u.email || "",
        subject: "Motari complaint",
        message: complaint.trim(),
      });
      setComplaintSent(true);
      setComplaint("");
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  /* ── map contents ───────────────────────────────────────────────────────── */
  const ride: RideDto | undefined = state?.activeRide;
  const me: MapPoint | null = myPos;
  const mapPickup: MapPoint | null = ride ? { latitude: ride.pickupLat, longitude: ride.pickupLng } : null;
  const mapDest: MapPoint | null = ride && ride.destLat != null && ride.destLng != null
    ? { latitude: ride.destLat, longitude: ride.destLng } : null;
  // Waiting passengers as tappable pins: name the place and the fare so a driver
  // can judge a request from the map alone, then tap to accept it.
  // While on a ride the main map draws the road ahead: to the pickup first,
  // then to the destination once the passenger is on board.
  const [navRoute, setNavRoute] = useState<RouteResult | null>(null);
  const target: MapPoint | null = ride
    ? (ride.status === "IN_RIDE" && ride.destLat != null && ride.destLng != null
        ? { latitude: ride.destLat, longitude: ride.destLng }
        : { latitude: ride.pickupLat, longitude: ride.pickupLng })
    : null;
  const targetKey = target ? `${ride?.status}:${target.latitude},${target.longitude}` : "";
  const legKey = myPos ? `${myPos.latitude.toFixed(3)},${myPos.longitude.toFixed(3)}` : "";
  useEffect(() => {
    if (!target || !myPos) { setNavRoute(null); return; }
    getRoute(myPos, target).then(setNavRoute).catch(() => {});
    // Recompute per leg and roughly every 100 m of movement, not on every fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, legKey]);

  const seekers: ExtraPoint[] = !ride && online
    ? (state?.nearby ?? []).map(n => ({
        id: n.id,
        latitude: n.pickupLat,
        longitude: n.pickupLng,
        label: `${n.pickupName || (t("motari.dash.waiting_here") || "Waiting here")} · ${km(n.distanceToPickupM)}`
             + ((n.offeredFareRwf ?? n.quotedFareRwf) != null ? ` · ${fmt((n.offeredFareRwf ?? n.quotedFareRwf)!)}` : ""),
      }))
    : [];

  /* ── styles (passenger-app vocabulary) ──────────────────────────────────── */
  const glass: React.CSSProperties = {
    background: "rgba(0,0,0,0.94)", backdropFilter: "blur(12px)", border: "1px solid #1f1f1f",
  };
  const micro: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#666",
  };
  const input: React.CSSProperties = {
    width: "100%", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 9,
    padding: "10px 12px", color: "#fff", fontSize: 12.5, fontWeight: 500,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const cta = (enabled: boolean, bg = "#f97316"): React.CSSProperties => ({
    width: "100%", background: enabled ? bg : "#1a1a1a", color: enabled ? "#000" : "#555",
    borderRadius: 10, padding: "11px 20px", fontWeight: 900, fontSize: 11.5,
    letterSpacing: "0.04em", border: "none", cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit", textTransform: "uppercase",
  });
  const card: React.CSSProperties = {
    background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: 12,
  };

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", display: "flex", justifyContent: "center" }}>
      <div className="drive-frame" style={{ position: "relative", width: "100%", maxWidth: 480, height: "100%", background: "#000", overflow: "hidden" }}>

        {/* MAP — the driver is the moto icon, ringed by the device's accuracy circle */}
        <MotariMap
          pickup={mapPickup} destination={mapDest} driver={me}
          selfAccuracyM={gpsAcc} extras={seekers}
          route={navRoute ? navRoute.coordinates : null}
          onExtraClick={id => act(() => acceptRide(id, token()))}
        />

        {/* Brand chip */}
        <div style={{
          position: "absolute", top: 14, left: 14, zIndex: 999, ...glass, borderRadius: 999,
          padding: "7px 13px", display: "flex", alignItems: "center", gap: 6, color: "#fff",
          fontWeight: 800, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          <Bike size={11} color="#f97316" />
          {state?.profile?.plateNumber || "Motari"}
        </div>

        {/* Language, top centre: a motari picks their own language here. */}
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1002 }}>
          <button onClick={() => setLangOpen(o => !o)} aria-label="Language" style={{
            ...glass, borderRadius: 999, padding: "7px 12px", display: "flex", alignItems: "center",
            gap: 5, cursor: "pointer", color: "#fff", fontSize: 9.5, fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit",
          }}>
            <Globe size={12} color="#f97316" />
            {language === "kinyy" ? "RW" : language.toUpperCase()}
          </button>
          {langOpen && (
            <div style={{ ...glass, position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", borderRadius: 12, overflow: "hidden", width: 128 }}>
              {([
                ["en", "English"], ["fr", "Français"], ["kinyy", "Kinyarwanda"], ["sw", "Kiswahili"],
              ] as const).map(([code, label]) => (
                <button key={code} onClick={() => { setLanguage(code); setLangOpen(false); }} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "9px 12px", background: "none", border: "none",
                  borderBottom: "1px solid #1a1a1a", cursor: "pointer", fontFamily: "inherit",
                  color: language === code ? "#f97316" : "#ccc", fontSize: 11, fontWeight: 600,
                }}>
                  {label}
                  {language === code && <span style={{ fontSize: 9 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Online toggle, top right */}
        <button
          onClick={() => !ride && act(() => setMotariOnline(!online, token()))}
          disabled={busy || !!ride}
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 999, ...glass,
            borderRadius: 999, padding: "7px 13px", display: "flex", alignItems: "center", gap: 6,
            fontWeight: 900, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
            color: online ? "#22c55e" : "#888", cursor: ride ? "not-allowed" : "pointer",
            borderColor: online ? "#14532d" : "#1f1f1f", fontFamily: "inherit",
          }}
        >
          <Power size={11} />
          {online ? (t("motari.dash.online") || "Online") : (t("motari.dash.offline") || "Offline")}
        </button>

        {/* INCOMING OFFER — top left, 30s countdown, then it moves to the next motari */}
        {state?.offer && !ride && offerLeft > 0 && (
          <div style={{
            position: "absolute", top: 54, left: 14, zIndex: 1001, ...glass,
            borderRadius: 14, padding: "12px 14px", width: 240,
            borderColor: "#f97316", boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ ...micro, color: "#f97316", flex: 1 }}>
                {t("motari.dash.offer_title") || "New ride for you"}
              </span>
              <span style={{
                fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums",
                color: offerLeft <= 10 ? "#f87171" : "#fff",
              }}>
                {offerLeft}s
              </span>
            </div>
            <div style={{ height: 3, background: "#1a1a1a", borderRadius: 999, marginBottom: 10 }}>
              <div style={{
                height: "100%", borderRadius: 999, background: offerLeft <= 10 ? "#f87171" : "#f97316",
                width: `${Math.min(100, (offerLeft / Math.max(1, state.offer.expiresInSeconds)) * 100)}%`,
                transition: "width 1s linear",
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#ccc", lineHeight: 1.7, marginBottom: 10 }}>
              <b style={{ color: "#fff" }}>{state.offer.passengerName}</b>
              {" · "}{km(state.offer.distanceToPickupM)} {t("motari.dash.away") || "away"}
              <br />
              <span style={{ color: "#f97316" }}>●</span> {state.offer.pickupName || "Pinned pickup"}
              <br />
              <span style={{ color: "#16a34a" }}>●</span> {state.offer.destName || (t("motari.dash.open_ride") || "open ride")}
              <br />
              <b style={{ color: "#f97316" }}>
                {state.offer.offeredFareRwf != null ? `${fmt(state.offer.offeredFareRwf)} · ${t("motari.dash.their_price") || "their price"}`
                  : state.offer.quotedFareRwf != null ? fmt(state.offer.quotedFareRwf)
                  : (t("motari.dash.meter_ride") || "Meter ride")}
              </b>
              {state.offer.payViaPlatform && (
                <span style={{ ...micro, color: "#4ade80", marginLeft: 6 }}>{t("motari.dash.platform_pay") || "Platform pay"}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => act(() => acceptRide(state.offer!.rideId, token()))}
                style={{ flex: 1.4, background: "#f97316", color: "#000", borderRadius: 9, padding: "9px 8px", fontWeight: 900, fontSize: 10.5, border: "none", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                {t("motari.dash.accept") || "Accept"}
              </button>
              <button disabled={busy} onClick={() => act(() => declineRide(state.offer!.rideId, token()))}
                style={{ flex: 1, background: "transparent", color: "#888", borderRadius: 9, padding: "9px 8px", fontWeight: 800, fontSize: 10.5, border: "1px solid #2a2a2a", cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                {t("motari.dash.decline") || "Pass"}
              </button>
            </div>
          </div>
        )}

        {/* Coarse-fix warning: the browser is guessing from the network, not GPS */}
        {gpsAcc != null && gpsAcc > 150 && (
          <div style={{
            position: "absolute", top: 54, right: 14, zIndex: 998, ...glass,
            borderRadius: 8, padding: "5px 10px", fontSize: 8.5, fontWeight: 800,
            letterSpacing: "0.08em", textTransform: "uppercase", color: "#fbbf24", maxWidth: 200,
          }}>
            {(t("motari.dash.gps_coarse") || "Approximate location. Turn on precise GPS.")}
            {" "}±{gpsAcc >= 1000 ? (gpsAcc / 1000).toFixed(1) + " km" : Math.round(gpsAcc) + " m"}
          </div>
        )}

        {/* BOTTOM SHEET */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
          <div style={{
            ...glass, borderRadius: "18px 18px 0 0", borderBottom: "none",
            padding: "8px 14px 16px", maxHeight: "70dvh", overflowY: "auto",
          }}>
            <button
              onClick={() => setMinimized(m => !m)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "2px 0 6px", color: "#666", fontFamily: "inherit" }}
            >
              <span style={{ width: 34, height: 3, borderRadius: 999, background: "#333" }} />
              {minimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {minimized ? (
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: online ? "#22c55e" : "#888" }}>●</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ride ? (t("motari.dash.on_ride") || "On a ride") : online ? `${state?.nearby?.length ?? 0} ${t("motari.dash.seeking") || "passengers seeking"}` : (t("motari.dash.offline_hint") || "Offline")}
                </span>
                {history && <span style={{ marginLeft: "auto", color: "#f97316", flexShrink: 0 }}>{fmt(history.walletBalanceRwf)}</span>}
              </div>
            ) : (
              <>
                {/* tab bar */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {([
                    ["rides", t("motari.dash.tab_rides") || "Rides"],
                    ["money", t("motari.dash.tab_money") || "Money"],
                    ["trips", t("motari.dash.tab_trips") || "Trips"],
                    ["more", t("motari.dash.tab_more") || "More"],
                  ] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)} style={{
                      flex: 1, borderRadius: 999, padding: "7px 4px", fontSize: 9.5, fontWeight: 900,
                      letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
                      background: tab === key ? "#f97316" : "transparent",
                      color: tab === key ? "#000" : "#777",
                      border: tab === key ? "none" : "1px solid #1f1f1f",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ══ RIDES ══ */}
                {tab === "rides" && (
                  !state?.profile ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <p style={{ color: "#999", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                        {t("motari.dash.no_profile") || "Register your moto to start driving."}
                      </p>
                      <input style={input} placeholder={t("motari.register.legal_name") || "Legal name"} value={legalName} onChange={e => setLegalName(e.target.value)} maxLength={120} />
                      <input style={input} placeholder={t("motari.register.plate") || "Plate number"} value={plate} onChange={e => setPlate(e.target.value)} maxLength={20} />
                      <input style={input} placeholder={t("motari.register.brand") || "Brand or model"} value={brand} onChange={e => setBrand(e.target.value)} maxLength={60} />
                      <button disabled={busy || plate.trim().length < 4}
                        onClick={() => act(() => saveMotariProfile({ plateNumber: plate, brandModel: brand || undefined, legalName: legalName || undefined }, token()))}
                        style={cta(!busy && plate.trim().length >= 4)}>
                        {t("motari.dash.save_moto") || "Save moto"}
                      </button>
                    </div>
                  ) : ride ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>
                          {ride.status === "ASSIGNED" && (t("motari.dash.head_pickup") || "Head to the pickup")}
                          {ride.status === "ARRIVED" && (t("motari.dash.waiting") || "Waiting for your passenger")}
                          {ride.status === "IN_RIDE" && (t("motari.dash.riding") || "Ride in progress")}
                          {ride.status === "COMPLETED" && (t("motari.dash.collect") || "Collect the fare")}
                        </span>
                        <span style={{ ...micro, color: "#f97316" }}>{ride.fareMode}</span>
                      </div>

                      <div style={{ ...card, fontSize: 12, color: "#bbb", lineHeight: 1.8 }}>
                        <b style={{ color: "#fff" }}>{ride.passengerName}</b>
                        {ride.passengerPhone && (
                          <a href={`tel:${ride.passengerPhone}`} style={{ marginLeft: 10, color: "#f97316", textDecoration: "none", fontWeight: 800 }}>
                            <Phone size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {ride.passengerPhone}
                          </a>
                        )}
                        <div style={{ color: "#999" }}>
                          <span style={{ color: "#f97316" }}>●</span> {ride.pickupName || "Pinned pickup"}<br />
                          <span style={{ color: "#16a34a" }}>●</span> {ride.destName || (t("motari.dash.open_dest") || "Passenger directs you. Meter runs.")}
                        </div>
                        {navRoute && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                          <div style={{ ...micro, color: "#f97316" }}>
                            {ride.status === "IN_RIDE"
                              ? (t("motari.dash.to_dest") || "To destination")
                              : (t("motari.dash.to_pickup") || "To pickup")}
                            {" · "}{fmtDistance(navRoute.distanceM)} · {fmtDuration(navRoute.durationS)}
                          </div>
                        )}
                        <div style={{ color: "#fff", fontWeight: 900 }}>
                          {ride.finalFareRwf != null ? fmt(ride.finalFareRwf)
                            : ride.offeredFareRwf != null ? `${fmt(ride.offeredFareRwf)} · ${t("motari.dash.their_price") || "their price"}`
                            : ride.fareMode === "QUOTED" && ride.quotedFareRwf != null ? fmt(ride.quotedFareRwf)
                            : `${km(ride.riddenDistanceM)} · ${fmt(ride.baseFareRwf)} + ${fmt(ride.perKmRwf)}/km`}
                        </div>
                      </div>


                      {ride.status === "ASSIGNED" && (
                        <button disabled={busy} onClick={() => act(() => motariArrived(ride.id, token()))} style={cta(!busy)}>
                          {t("motari.dash.btn_arrived") || "I have arrived"}
                        </button>
                      )}
                      {ride.status === "ARRIVED" && (
                        <button disabled={busy} onClick={() => act(() => motariStart(ride.id, token()))} style={cta(!busy)}>
                          {t("motari.dash.btn_start") || "Passenger on board. Start"}
                        </button>
                      )}
                      {ride.status === "IN_RIDE" && (
                        <button disabled={busy} onClick={() => act(() => motariComplete(ride.id, token()))} style={cta(!busy)}>
                          <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                          {t("motari.dash.btn_complete") || "Complete ride"}
                        </button>
                      )}
                      {ride.status === "COMPLETED" && (
                        ride.paymentStatus === "PAID" ? (
                          <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800 }}>
                            ✓ {t("motari.dash.paid_platform") || "Paid via platform. Wallet credited."}
                          </div>
                        ) : (
                          <>
                            {ride.paymentMethod === "PLATFORM" && ride.paymentStatus === "PENDING" && (
                              <div style={{ color: "#fbbf24", fontSize: 11.5, fontWeight: 700 }}>
                                {t("motari.dash.platform_pending") || "Passenger is paying via platform. You can still take cash if they change their mind."}
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button disabled={busy} onClick={() => act(() => motariPaid(ride.id, "CASH", token()))} style={{ ...cta(!busy), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <Banknote size={13} /> {t("motari.dash.btn_cash") || "Paid cash"}
                              </button>
                              <button disabled={busy} onClick={() => act(() => motariPaid(ride.id, "MOMO", token()))} style={{ ...cta(!busy, "#16a34a"), color: busy ? "#555" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <Smartphone size={13} /> {t("motari.dash.btn_momo") || "Paid by MoMo"}
                              </button>
                            </div>
                          </>
                        )
                      )}
                      {["ASSIGNED", "ARRIVED"].includes(ride.status) && (
                        <button disabled={busy} onClick={() => act(() => motariCancelRide(ride.id, undefined, token()))} style={{
                          background: "transparent", color: "#f87171", borderRadius: 10, padding: "9px 18px",
                          fontWeight: 800, fontSize: 10.5, border: "1px solid #451a1a", cursor: "pointer",
                          fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase",
                        }}>
                          <X size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5 }} />
                          {t("motari.dash.btn_handback") || "Hand ride back"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {!online ? (
                        <button disabled={busy} onClick={() => act(() => setMotariOnline(true, token()))} style={cta(!busy)}>
                          <Power size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 6 }} />
                          {t("motari.dash.go_online") || "Go online"}
                        </button>
                      ) : (
                        <>
                          <div style={{ ...micro }}>
                            {(state?.nearby?.length ?? 0)} {t("motari.dash.seeking") || "passengers seeking"}
                            {gpsError && <span style={{ color: "#f87171" }}> · {gpsError}</span>}
                          </div>
                          {(state?.nearby?.length ?? 0) === 0 ? (
                            <p style={{ color: "#666", fontSize: 12, margin: 0 }}>
                              {t("motari.dash.no_requests") || "No requests around you. Stay online, this refreshes on its own."}
                            </p>
                          ) : (
                            state!.nearby!.map(n => (
                              <div key={n.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {n.pickupName || "Pinned pickup"}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                    {km(n.distanceToPickupM)} {t("motari.dash.away") || "away"} · {n.destName ? `→ ${n.destName}` : (t("motari.dash.open_ride") || "open ride")}
                                    {(n.offeredFareRwf ?? n.quotedFareRwf) != null && (
                                      <b style={{ color: "#f97316" }}>
                                        {" · "}{fmt((n.offeredFareRwf ?? n.quotedFareRwf)!)}
                                        {n.offeredFareRwf != null && ` · ${t("motari.dash.their_price") || "their price"}`}
                                      </b>
                                    )}
                                  </div>
                                </div>
                                <button disabled={busy} onClick={() => act(() => acceptRide(n.id, token()))} style={{
                                  background: "#f97316", color: "#000", borderRadius: 999, padding: "8px 18px",
                                  fontWeight: 900, fontSize: 10.5, border: "none", cursor: "pointer",
                                  fontFamily: "inherit", textTransform: "uppercase", flexShrink: 0,
                                }}>
                                  {t("motari.dash.accept") || "Accept"}
                                </button>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )
                )}

                {/* ══ MONEY ══ */}
                {tab === "money" && history && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div style={{ ...card, textAlign: "center" }}>
                        <div style={micro}>{t("motari.dash.wallet") || "Wallet"}</div>
                        <div style={{ color: "#f97316", fontWeight: 900, fontSize: 14, marginTop: 3 }}>{fmt(history.walletBalanceRwf)}</div>
                      </div>
                      <div style={{ ...card, textAlign: "center" }}>
                        <div style={micro}>{t("motari.dash.collected") || "Collected"}</div>
                        <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, marginTop: 3 }}>{fmt(history.totalCollectedRwf)}</div>
                      </div>
                      <div style={{ ...card, textAlign: "center" }}>
                        <div style={micro}>{t("motari.dash.rides") || "Rides"}</div>
                        <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, marginTop: 3 }}>{history.totalRides}</div>
                      </div>
                    </div>

                    <div style={{ ...micro, marginTop: 4 }}>{t("motari.dash.withdraw") || "Withdraw instantly"}</div>
                    {wStep === "FORM" && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <input style={input} placeholder={t("motari.dash.w_amount") || "Amount (min 500)"} value={wAmount}
                                 onChange={e => setWAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
                          <input style={input} placeholder="07xx xxx xxx" value={wPhone}
                                 onChange={e => setWPhone(e.target.value)} inputMode="tel" maxLength={20} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {(["MTN_MOMO", "AIRTEL_MONEY"] as const).map(p => (
                            <button key={p} onClick={() => setWProvider(p)} style={{
                              flex: 1, borderRadius: 9, padding: "8px 4px", fontSize: 10, fontWeight: 800,
                              cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
                              background: wProvider === p ? "#f97316" : "#0a0a0a",
                              color: wProvider === p ? "#000" : "#888",
                              border: wProvider === p ? "none" : "1px solid #1f1f1f",
                            }}>
                              {p === "MTN_MOMO" ? "MTN MoMo" : "Airtel Money"}
                            </button>
                          ))}
                        </div>
                        <button disabled={busy || !parseInt(wAmount || "0", 10) || parseInt(wAmount, 10) < 500 || wPhone.replace(/\D/g, "").length < 9}
                          onClick={withdraw}
                          style={cta(!busy && parseInt(wAmount || "0", 10) >= 500 && wPhone.replace(/\D/g, "").length >= 9)}>
                          {t("motari.dash.w_cta") || "Withdraw"}
                        </button>
                      </>
                    )}
                    {wStep === "CODE" && (
                      <>
                        <input style={{ ...input, textAlign: "center", letterSpacing: "0.4em", fontWeight: 800, fontSize: 16 }}
                               placeholder="000000" value={wCode}
                               onChange={e => setWCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" />
                        <button disabled={busy || wCode.trim().length < 4} onClick={confirmW} style={cta(!busy && wCode.trim().length >= 4)}>
                          {t("motari.dash.w_confirm") || "Confirm withdrawal"}
                        </button>
                      </>
                    )}
                    {wStep === "DONE" && (
                      <button onClick={() => { setWStep("FORM"); setWAmount(""); setWCode(""); setWMsg(""); }} style={cta(true)}>
                        {t("motari.dash.w_again") || "New withdrawal"}
                      </button>
                    )}
                    {wMsg && <div style={{ fontSize: 11.5, color: wStep === "DONE" ? "#4ade80" : "#bbb" }}>{wMsg}</div>}
                    <div style={{ ...micro, color: "#555" }}>
                      {t("motari.dash.w_note") || "Cash fares are yours on the spot. MoMo fares land in the wallet minus commission."}
                    </div>
                  </div>
                )}

                {/* ══ TRIPS ══ */}
                {tab === "trips" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(history?.rides?.length ?? 0) === 0 ? (
                      <p style={{ color: "#666", fontSize: 12, margin: 0 }}>{t("motari.dash.no_trips") || "No trips yet."}</p>
                    ) : (
                      history!.rides.map(r => (
                        <div key={r.id} style={{ ...card, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
                              {r.passengerName}
                              {r.rating != null && (
                                <span style={{ marginLeft: 8, fontSize: 10.5, color: "#fbbf24" }}>
                                  <Star size={9} fill="#fbbf24" color="#fbbf24" style={{ display: "inline", verticalAlign: "-1px" }} /> {r.rating}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10.5, color: "#888", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {when(r.requestedAt)} · {r.pickupName || "pickup"} {r.destName ? `→ ${r.destName}` : ""}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: 12.5, color: r.status === "CLOSED" ? "#f97316" : "#666" }}>
                              {r.finalFareRwf != null ? fmt(r.finalFareRwf) : "—"}
                            </div>
                            <div style={{ ...micro, color: r.status === "CLOSED" ? "#4ade80" : "#666" }}>{r.status}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ══ MORE ══ */}
                {tab === "more" && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={micro}>{t("motari.dash.complaint") || "Raise a complaint"}</div>
                    {complaintSent ? (
                      <div style={{ fontSize: 12, color: "#4ade80" }}>
                        {t("motari.dash.complaint_sent") || "Sent. Support will reach out."}
                      </div>
                    ) : (
                      <>
                        <textarea
                          style={{ ...input, minHeight: 80, resize: "vertical" }}
                          placeholder={t("motari.dash.complaint_ph") || "Tell us what happened"}
                          value={complaint}
                          onChange={e => setComplaint(e.target.value)}
                          maxLength={2000}
                        />
                        <button disabled={busy || complaint.trim().length < 10} onClick={sendComplaint} style={cta(!busy && complaint.trim().length >= 10)}>
                          {t("motari.dash.complaint_cta") || "Send complaint"}
                        </button>
                      </>
                    )}

                    <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 10, display: "grid", gap: 8 }}>
                      <a href="/motari" style={{ color: "#888", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}>
                        <Bike size={11} color="#f97316" style={{ display: "inline", verticalAlign: "-1px", marginRight: 6 }} />
                        {t("motari.dash.passenger_page") || "Open the passenger page"}
                      </a>
                      <button onClick={logout} style={{
                        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
                        color: "#f87171", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: 0,
                      }}>
                        <LogOut size={11} /> {t("motari.dash.logout") || "Log out"}
                      </button>
                    </div>
                  </div>
                )}

                {error && <div style={{ color: "#f87171", fontSize: 11.5, marginTop: 10 }}>{error}</div>}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .drive-frame input::placeholder, .drive-frame textarea::placeholder { color: #4a4a4a; font-weight: 400; opacity: 1; }
        @keyframes gpspulse { 0% { transform: scale(0.6); opacity: 0.9 } 100% { transform: scale(1.8); opacity: 0 } }
        @media (min-width: 520px) {
          .drive-frame { border-left: 1px solid #1f1f1f; border-right: 1px solid #1f1f1f; box-shadow: 0 0 80px rgba(0,0,0,0.9); }
        }
      `}</style>
    </div>
  );
}
