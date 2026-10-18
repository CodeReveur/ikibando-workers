"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MotariMap, type MapPoint, type ExtraPoint } from "@/components/motari/MotariMap";
import { getRoute, fmtDistance, fmtDuration, type RouteResult, type RouteStep } from "@/lib/routing";
import { useTurnByTurn } from "@/lib/turn-by-turn";
import {
  getMotariState, getMotariHistory, getMotariRewards, type MotariRewards,
  setMotariOnline, motariHeartbeat,
  acceptRide, declineRide, motariArrived, motariComplete, motariCancelRide,
  motariParcelReceived, motariParcelDelivered,
  setMotariCourier, setMotariPayout, payMotariFees, submitContact,
  ratePassenger, denyCashPayment, apiError,
  type MotariState, type MotariHistory, type RideDto,
  withdrawMotariWallet, getBonuses, claimBonuses,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { AppTip } from "@/components/app/get-the-app";
import { playSound, startSoundLoop, stopSoundLoop, unlockSounds } from "@/lib/sounds";
import { formatRwPhone, isValidRwPhone } from "@/lib/phone";
import { InstallPrompt } from "@/components/motari/InstallPrompt";
import {
  Bike, Phone, Power, CheckCircle2, X, Star, LogOut, ChevronDown, ChevronUp, Globe, Package,
  AlertTriangle, Volume2, VolumeX, Navigation, Gift, Copy, Share2,
  CornerUpLeft, CornerUpRight, ArrowUp, RotateCcw, Flag,
} from "lucide-react";

/**
 * An arrow that matches the words, so the shape of the turn is readable at a
 * glance without reading anything.
 */
function turnIcon(step: RouteStep) {
  if (step.type === "arrive") return Flag;
  const mod = (step.modifier || "").toLowerCase();
  if (mod.includes("uturn")) return RotateCcw;
  if (mod.includes("left")) return CornerUpLeft;
  if (mod.includes("right")) return CornerUpRight;
  return ArrowUp;
}

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
  const [courierOpen, setCourierOpen] = useState(false);

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

  // settings: payout preferences and the phone-change request
  const [payPhone, setPayPhone] = useState("");
  /*
   * Bonus money, which is in the wallet but not spendable until it is claimed.
   *
   * A motari earning a welcome bonus or a referral could see the figure in the app and had no
   * way on the web to turn it into money: the claim lives on the worker dashboard, which a
   * motari never reaches because signing in as one goes straight here.
   */
  const [claimable, setClaimable] = useState(0);
  const [amountOut, setAmountOut] = useState("");
  const [phoneReq, setPhoneReq] = useState("");
  const [phoneReqSent, setPhoneReqSent] = useState(false);

  // complaint
  const [complaint, setComplaint] = useState("");
  const [complaintSent, setComplaintSent] = useState(false);

  const token = () => localStorage.getItem("access_token") ?? "";

  // The fee sits on the top bar through the evening and night, when a motari is
  // counting the day's takings; in the working day it lives in the Money tab.
  const [feeError, setFeeError] = useState("");
  const hour = new Date().getHours();
  const feeHours = hour >= 16 || hour < 8;
  const fees = state?.fees;
  const feeOwing = !!fees && fees.dueAmountRwf > 0;

  const payFees = async () => {
    if (busy) return;
    setBusy(true);
    setFeeError("");
    try { setState(await payMotariFees(undefined, token())); }
    catch (e) { setFeeError(apiError(e)); }
    setBusy(false);
  };

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
  // A parcel announces itself with the delivery tone, not the ride tone.
  const ringing = !!state?.offer && !state?.activeRide && offerLeft > 0;
  const ringKey = state?.offer?.kind === "COURIER" ? "incoming-delivery" : "incoming-ride";
  useEffect(() => {
    if (ringing) {
      // Switching kind mid-ring would otherwise leave the old tone playing.
      stopSoundLoop(ringKey === "incoming-ride" ? "incoming-delivery" : "incoming-ride");
      startSoundLoop(ringKey);
    } else {
      stopSoundLoop("incoming-ride");
      stopSoundLoop("incoming-delivery");
    }
  }, [ringing, ringKey]);
  useEffect(() => () => {
    stopSoundLoop("incoming-ride");
    stopSoundLoop("incoming-delivery");
  }, []);

  /*
   * No session, no driver screen.
   *
   * This redirected in an effect and then carried on rendering, so somebody
   * signed out saw the whole working surface with an empty state behind it,
   * which reads as an account with no moto rather than as no account. The gate
   * is held below until the state has actually arrived.
   */
  const [signedOut, setSignedOut] = useState(false);

  // Asked for once the tab is opened rather than on every poll: it changes when a bonus is
  // awarded, which is rare, and the money tab is where the number is of any use.
  useEffect(() => {
    if (tab !== "money") return;
    const t = token();
    if (!t) return;
    let alive = true;
    getBonuses(t)
      .then(b => { if (alive) setClaimable(b.claimable ?? 0); })
      .catch(() => { /* the tab is still worth showing without it */ });
    return () => { alive = false; };
  }, [tab]);
  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      setSignedOut(true);
      window.location.href = "/signin";
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await getMotariState(token()));
      setError("");
    } catch (e) {
      // The axios layer already retried with the refresh token, so a 401 here
      // is a session that is genuinely finished. Showing the driver screen to
      // somebody in that position is how a signed out visitor ended up being
      // asked to register a moto.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setSignedOut(true);
        window.location.href = "/signin";
        return;
      }
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

  /*
   * The invite code, and what it has been worth.
   *
   * Asked for when the tab that shows it opens, not on the five second poll: it
   * is a code rather than a live figure, and it does not change while somebody
   * is reading it out to a friend.
   */
  const [rewards, setRewards] = useState<MotariRewards | null>(null);
  useEffect(() => {
    if (tab !== "more" || rewards) return;
    getMotariRewards(token()).then(setRewards).catch(() => {
      // Nothing drawn. A missing code is better than a card explaining why
      // there is no code.
    });
  }, [tab, rewards]);

  /**
   * How tight a fix has to be before it is worth telling passengers about.
   *
   * Generous, because a motari on a phone in a street usually beats this by an
   * order of magnitude, and the ones who do not are the ones indoors or on a
   * laptop, whose position is a guess at the neighbourhood rather than the
   * corner they are standing on.
   */
  const USABLE_FIX_M = 500;

  /* ── GPS: always watched, so the map shows the exact device position and
        auto-refreshes as it moves — online or not. ──────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(t("motari.dash.gps_off") || "Enable location to receive rides.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      p => {
        /*
         * Every reading is drawn; not every reading is acted on.
         *
         * This used to discard anything worse than five kilometres, which on a
         * laptop is every reading there is: the moto never appeared, no route
         * was worked out, and no heartbeat went anywhere, so a motari working
         * from a browser was invisible and simply never got offered a ride.
         *
         * The distinction that actually matters is not whether to show it but
         * whether to broadcast it. A coarse fix on the map is honest, ringed
         * by its accuracy circle. A coarse fix in a heartbeat tells a waiting
         * passenger there is a moto somewhere inside thirty kilometres of them,
         * which is worse than saying nothing.
         */
        const accuracy = p.coords.accuracy ?? null;
        const trustworthy = accuracy == null || accuracy <= USABLE_FIX_M;

        setMyPos({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setGpsAcc(accuracy);
        setGpsError("");

        // Only a fix worth standing on reaches the heartbeat and the routing.
        posRef.current = trustworthy
          ? { lat: p.coords.latitude, lng: p.coords.longitude }
          : null;
      },
      () => setGpsError(t("motari.dash.gps_off") || "Enable location to receive rides."),
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [t]);

function isMandatoryOnlineHours(): boolean {
  const now = new Date();
  const kigaliHour = (now.getUTCHours() + 2) % 24;
  return kigaliHour >= 5 && kigaliHour < 21;
}

  /* ── Heartbeat to the platform only while online ────────────────────────── */
  const mandatoryOnline = isMandatoryOnlineHours();
  const online = mandatoryOnline || !!state?.profile?.online;

  // Auto-sync online mode during mandatory hours (5am to 21pm)
  useEffect(() => {
    if (mandatoryOnline && state?.profile && !state.profile.online && !busy) {
      setMotariOnline(true, token()).then(setState).catch(() => {});
    }
  }, [mandatoryOnline, state?.profile?.online, busy]);

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

  // Ask support to change the number on the account; the driver cannot self-serve
  // this, because the number is an identity fact tied to payouts.
  const requestPhoneChange = async () => {
    if (!isValidRwPhone(phoneReq) || busy) return;
    setBusy(true);
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      await submitContact({
        name: u.name || "Motari",
        email: u.email || "",
        subject: "Motari phone number change",
        message: "Please change my account phone number to " + phoneReq
               + " (plate " + (state?.profile?.plateNumber ?? "unknown") + ").",
      });
      setPhoneReqSent(true);
      setPhoneReq("");
    } catch (e) { setError(apiError(e)); }
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

  // The road ahead is already known; this is what says it out loud. Guidance
  // only runs while a ride is actually under way, so an idle motari waiting for
  // work is never spoken to.
  const guiding = !!ride && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status);
  const { next: nextTurn, muted: voiceMuted, setMuted: setVoiceMuted } =
    useTurnByTurn(navRoute, myPos, guiding);

  /** Copied, said so briefly, and then quiet again. */
  const [copied, setCopied] = useState(false);
  const copyInvite = (code: string) => {
    navigator.clipboard?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => { /* a browser that will not copy still shows the code */ });
  };

  /**
   * The link carries the code, so one tap opens the sign-up form with the
   * invitation already on it. The same message the app sends.
   */
  const inviteWhatsApp = (code: string) => {
    const text = (t("rewards.share_text")
      || "Ride with Ask Motari. Sign up here and my code {code} is already on it: "
       + "https://mpahmapu.com/motari?register=1&ref={code}")
      .replace(/\{code\}/g, code);
    return "https://wa.me/?text=" + encodeURIComponent(text);
  };

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
  /*
   * The strip down the top of the map is a stack, and everything in it has to
   * know what stands above it. Each row that appears pushes the next one down,
   * rather than four overlays hard-coding the same offsets and drifting apart
   * the first time one of them changes height.
   */
  const feeShowing = !!(fees?.paused || (feeOwing && feeHours));
  const BANNER_ROW = 76;
  const feeTop = 52;
  const turnTop = feeTop + (feeShowing ? BANNER_ROW : 0);
  const switchTop = turnTop + (guiding ? BANNER_ROW : 0);
  const tipTop = switchTop + 52;

  const glass: React.CSSProperties = {
    background: "rgba(18,18,18,0.96)", backdropFilter: "blur(14px)", border: "1px solid #2e2e2e",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
  };
  const micro: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#888",
  };
  const input: React.CSSProperties = {
    width: "100%", background: "#141414", border: "1px solid #2e2e2e", borderRadius: 9,
    padding: "10px 12px", color: "#fff", fontSize: 12.5, fontWeight: 500,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const cta = (enabled: boolean, bg = "#f97316"): React.CSSProperties => ({
    width: "100%", background: enabled ? bg : "#20160d", color: enabled ? "#000" : "#8e8e93",
    borderRadius: 10, padding: "11px 20px", fontWeight: 900, fontSize: 12,
    letterSpacing: "0.04em", border: enabled ? "none" : "1px solid #3d2512", cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit", textTransform: "uppercase", transition: "all 0.15s ease",
  });
  const card: React.CSSProperties = {
    background: "#161616", border: "1px solid #2e2e2e", borderRadius: 12, padding: "12px 14px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  };

  // Leaving for the sign in page counts as loading: the browser has not moved
  // yet, and half a driver screen in the meantime is what caused this.
  if (loading || signedOut) {
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
          switchStyle={{ top: switchTop, right: 14, bottom: "auto" }}
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

        {/* The daily fee, impossible to miss: paused accounts and evening
            reminders both sit right on the map. */}
        {feeShowing && (
          <div style={{
            position: "absolute", top: feeTop, left: 14, right: 14, zIndex: 1004, ...glass,
            borderRadius: 12, padding: "10px 12px",
            borderColor: fees?.paused ? "#7f1d1d" : "#7c3a10",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={13} color={fees?.paused ? "#f87171" : "#fbbf24"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: fees?.paused ? "#f87171" : "#fff",
                  fontSize: 11.5, fontWeight: 800, lineHeight: 1.4,
                }}>
                  {fees?.paused
                    ? (t("motari.fee.paused") || "Your account is inactive. Pay the fee to open it again.")
                    : (t("motari.fee.due") || "Daily fee due")}
                </div>
                <div style={{ ...micro, marginTop: 2 }}>
                  {fmt(fees?.dueAmountRwf ?? 0)}
                  {(fees?.dueDays ?? 0) > 1 && ` · ${fees!.dueDays} ${t("motari.fee.days") || "days"}`}
                </div>
              </div>
              <button
                disabled={busy || fees?.paymentPending}
                onClick={payFees}
                style={{
                  borderRadius: 9, padding: "8px 14px", fontSize: 9.5, fontWeight: 900,
                  letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                  fontFamily: "inherit", flexShrink: 0, border: "none",
                  background: fees?.paymentPending ? "#1a1a1a" : "#f97316",
                  color: fees?.paymentPending ? "#888" : "#000",
                }}
              >
                {fees?.paymentPending
                  ? (t("motari.fee.pending_short") || "Approve on phone")
                  : (t("motari.fee.pay_now") || "Pay now")}
              </button>
            </div>
            {feeError && (
              <div style={{ color: "#f87171", fontSize: 10.5, marginTop: 6 }}>
                {feeError} <button onClick={payFees} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, padding: 0 }}>
                  {t("motari.fee.try_again") || "Try again"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* The next manoeuvre, written out. It says the same words the voice
            says, so a motari who missed the sound can read it at the next stop,
            and one who heard it has the distance in front of them. The mute is
            beside it, because the moment you want it is the moment it speaks. */}
        {guiding && (() => {
          const Icon = nextTurn ? turnIcon(nextTurn.step) : Navigation;
          const aboard = ride!.status === "IN_RIDE";
          const headline = nextTurn
            ? nextTurn.step.instruction
            : aboard
              ? (t("motari.dash.to_dest") || "To destination")
              : (t("motari.dash.to_pickup") || "To pickup");
          const detail = nextTurn
            ? fmtDistance(nextTurn.metresAway)
            : navRoute
              ? `${fmtDistance(navRoute.distanceM)} · ${fmtDuration(navRoute.durationS)}`
              : (t("motari.dash.no_route") || "Working out the way. The pin still shows where to go.");

          return (
            <div style={{
              position: "absolute", top: turnTop, left: 14, right: 14, zIndex: 1003,
              ...glass, borderRadius: 12, padding: "10px 12px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Icon size={20} color="#f97316" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 800, lineHeight: 1.35 }}>
                  {headline}
                </div>
                <div style={{ ...micro, marginTop: 2 }}>{detail}</div>
              </div>
              <button
                type="button"
                onClick={() => setVoiceMuted(!voiceMuted)}
                aria-label={voiceMuted ? "Turn the voice on" : "Turn the voice off"}
                style={{
                  flexShrink: 0, background: "none", cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${voiceMuted ? "#2a2a2a" : "#f97316"}`,
                  borderRadius: 999, padding: "6px 8px", lineHeight: 0,
                }}
              >
                {voiceMuted
                  ? <VolumeX size={13} color="#888" />
                  : <Volume2 size={13} color="#f97316" />}
              </button>
            </div>
          );
        })()}

        {/* A motari working from a browser is a motari whose phone sleeps and
            whose offers go unheard. Offered while they are waiting for work,
            never during a ride, and only until they close it. */}
        {!ride && (
          <AppTip
            storageKey="drive.app_tip"
            style={{ position: "absolute", top: tipTop, left: 14, maxWidth: 250, zIndex: 1002 }}
          />
        )}

        {/* A fix too coarse to dispatch on is the one thing that will keep a
            motari online all day without a single offer. Say it plainly. */}
        {myPos && gpsAcc != null && gpsAcc > USABLE_FIX_M && (
          <div style={{
            position: "absolute", top: tipTop, left: 14, right: 14, zIndex: 1002,
            ...glass, borderRadius: 12, padding: "9px 12px",
            borderColor: "#7c3a10", color: "#fbbf24", fontSize: 11.5, lineHeight: 1.5,
          }}>
            ±{gpsAcc >= 1000 ? `${(gpsAcc / 1000).toFixed(0)} km` : `${Math.round(gpsAcc)} m`}
            {" · "}
            {t("motari.dash.gps_coarse") || "Approximate location. Turn on precise GPS."}
            {" "}
            {t("motari.dash.gps_coarse_why")
              || "No passenger can be matched to you until it sharpens."}
          </div>
        )}

        {/* Parcel demand, in the top row: tap it to see the waiting parcels. */}
        {online && !ride && (() => {
          const parcels = (state?.nearby ?? []).filter(n => n.kind === "COURIER");
          if (parcels.length === 0) return null;
          const nearest = Math.min(...parcels.map(p => p.distanceToPickupM));
          return (
            <div style={{ position: "absolute", top: 14, left: 100, zIndex: 1003 }}>
              <button onClick={() => setCourierOpen(o => !o)} style={{
                ...glass, borderRadius: 999, padding: "7px 12px", display: "flex", alignItems: "center", gap: 5,
                color: "#f97316", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", borderColor: "#7c3a10",
              }}>
                <Package size={11} />
                {parcels.length} · {km(nearest)}
                <ChevronDown size={10} />
              </button>
              {courierOpen && (
                <div style={{
                  ...glass, position: "absolute", top: 38, left: 0, borderRadius: 12,
                  overflow: "hidden", width: 230, maxHeight: "42dvh", overflowY: "auto",
                }}>
                  {parcels.map(p => (
                    <div key={p.id} style={{ padding: "10px 12px", borderBottom: "1px solid #1a1a1a" }}>
                      <div style={{ color: "#fff", fontSize: 11.5, fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                        {p.pickupName || (t("motari.dash.waiting_here") || "Waiting here")}
                      </div>
                      {p.parcelNote && (
                        <div style={{ color: "#aaa", fontSize: 10.5, marginTop: 2, overflowWrap: "anywhere" }}>{p.parcelNote}</div>
                      )}
                      <div style={{ ...micro, marginTop: 3 }}>
                        {km(p.distanceToPickupM)} {t("motari.dash.away") || "away"}
                        {(p.offeredFareRwf ?? p.quotedFareRwf) != null && (
                          <b style={{ color: "#f97316" }}> · {fmt((p.offeredFareRwf ?? p.quotedFareRwf)!)}</b>
                        )}
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => { setCourierOpen(false); act(() => acceptRide(p.id, token())); }}
                        style={{
                          marginTop: 7, width: "100%", background: "#f97316", color: "#000",
                          borderRadius: 8, padding: "7px 8px", fontWeight: 900, fontSize: 9.5,
                          border: "none", cursor: "pointer", fontFamily: "inherit",
                          letterSpacing: "0.08em", textTransform: "uppercase",
                        }}
                      >
                        {t("motari.dash.accept") || "Accept"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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

        {/* Online toggle, top right — absent from 5am to 21pm, appears after 21pm */}
        {!mandatoryOnline && (
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
        )}

        {/* INCOMING OFFER — top left; when the countdown ends it moves to the next motari */}
        {state?.offer && !ride && offerLeft > 0 && (
          <div style={{
            position: "absolute", top: 54, left: 14, zIndex: 1001, ...glass,
            borderRadius: 14, padding: "12px 14px", width: 240,
            borderColor: "#f97316", boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ ...micro, color: "#f97316", flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
                {state.offer.kind === "COURIER" && <Package size={11} />}
                {state.offer.kind === "COURIER"
                  ? (t("motari.dash.offer_parcel") || "Parcel for you")
                  : (t("motari.dash.offer_title") || "New ride for you")}
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
              {state.offer.parcelNote && (
                <>
                  <span style={{ color: "#f97316" }}>{state.offer.parcelNote}</span>
                  <br />
                </>
              )}
              <span style={{ color: "#f97316" }}>●</span> {state.offer.pickupName || "Pinned pickup"}
              <br />
              <span style={{ color: "#16a34a" }}>●</span> {state.offer.destName || (t("motari.dash.open_ride") || "open ride")}
              {state.offer.destName && state.offer.destLat == null && (
                <span style={{ ...micro, marginLeft: 6 }}>
                  {t("motari.dash.not_on_map") || "Not on the map"}
                </span>
              )}
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
            padding: "8px 14px 16px", maxHeight: "70dvh", overflowY: "auto", overflowX: "hidden",
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
                    ["more", t("motari.dash.tab_settings") || "Settings"],
                  ] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)} style={{
                      flex: 1, borderRadius: 8, padding: "7px 4px", fontSize: 10, fontWeight: 800,
                      letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
                      background: tab === key ? "#f97316" : "#141414",
                      color: tab === key ? "#000" : "#888",
                      border: tab === key ? "1px solid #f97316" : "1px solid #2e2e2e",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ══ RIDES ══ */}
                {tab === "rides" && (
                  !state?.profile ? (
                    /* The moto is registered on the registration page, which is
                       the one place that asks for it and the one place that
                       knows what a complete answer looks like. This is a
                       working screen; a second copy of that form here is how
                       the two drifted apart in the first place. */
                    <div style={{ display: "grid", gap: 10 }}>
                      <p style={{ color: "#999", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                        {t("motari.dash.no_profile") || "Register your moto to start driving."}
                      </p>
                      <a href="/motari?register=1&finish=1" style={{ ...cta(true), textAlign: "center", textDecoration: "none" }}>
                        {t("motari.dash.add_moto") || "Add your moto"}
                      </a>
                    </div>
                  ) : fees?.paused ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ color: "#f87171", fontSize: 12.5, fontWeight: 800, lineHeight: 1.5 }}>
                        {t("motari.fee.paused") || "Your account is inactive. Pay the fee to open it again."}
                      </div>
                      <div style={micro}>
                        {fmt(fees.dueAmountRwf)} · {fees.dueDays} {t("motari.fee.days") || "days"}
                      </div>
                      <button disabled={busy || fees.paymentPending} onClick={payFees} style={cta(!busy && !fees.paymentPending)}>
                        {fees.paymentPending
                          ? (t("motari.fee.pending") || "Approve the prompt on your phone")
                          : `${t("motari.fee.pay_now") || "Pay now"} · ${fmt(fees.dueAmountRwf)}`}
                      </button>
                      {feeError && (
                        <div style={{ color: "#f87171", fontSize: 11.5 }}>
                          {feeError}{" "}
                          <button onClick={payFees} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 800, padding: 0 }}>
                            {t("motari.fee.try_again") || "Try again"}
                          </button>
                        </div>
                      )}
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

                      <div style={{ ...card, fontSize: 12, color: "#bbb", lineHeight: 1.8, position: "relative" }}>
                        <b style={{ color: "#fff" }}>{ride.passengerName}</b>
                        {ride.passengerPhone && (
                          <>
                            <span style={{ marginLeft: 10, color: "#f97316", fontWeight: 800 }}>{ride.passengerPhone}</span>
                            {/* The call button mirrors the passenger's: one tap to reach the client. */}
                            <a href={`tel:${ride.passengerPhone}`} aria-label="Call passenger" style={{
                              position: "absolute", top: 10, right: 10,
                              background: "#f97316", borderRadius: "50%", width: 38, height: 38,
                              display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                            }}>
                              <Phone size={15} color="#000" />
                            </a>
                          </>
                        )}
                        {ride.kind === "COURIER" && (
                          <div style={{ ...micro, color: "#f97316" }}>
                            {t("motari.request.courier") || "Courier"}
                            {ride.parcelNote ? " · " + ride.parcelNote : ""}
                          </div>
                        )}
                        <div style={{ color: "#999" }}>
                          <span style={{ color: "#f97316" }}>●</span> {ride.pickupName || "Pinned pickup"}<br />
                          <span style={{ color: "#16a34a" }}>●</span> {ride.destName || (t("motari.dash.open_dest") || "Passenger directs you. Meter runs.")}
                          {ride.destName && ride.destLat == null && (
                            <span style={{ ...micro, marginLeft: 6 }}>
                              {t("motari.dash.ask_passenger") || "Not on the map. Ask the passenger."}
                            </span>
                          )}
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


                      {/* A parcel has no second phone in transit — only a motari
                          and an object — so nothing about it can be sensed. It is
                          collected, carried, delivered, and then the owner has
                          their say. */}
                      {ride.kind === "COURIER" ? (
                        <>
                          {["ASSIGNED", "ARRIVED"].includes(ride.status) && (
                            <button disabled={busy} onClick={() => act(() => motariParcelReceived(ride.id, token()))} style={cta(!busy)}>
                              <Package size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                              {t("motari.parcel.received") || "I have the parcel"}
                            </button>
                          )}
                          {ride.status === "IN_RIDE" && (
                            <button disabled={busy} onClick={() => act(() => motariParcelDelivered(ride.id, token()))} style={cta(!busy)}>
                              <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                              {t("motari.parcel.delivered") || "I delivered the parcel"}
                            </button>
                          )}
                          {ride.status === "COMPLETED" && !ride.deliveredAt && (
                            <button disabled={busy} onClick={() => act(() => motariParcelDelivered(ride.id, token()))} style={cta(!busy)}>
                              <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                              {t("motari.parcel.delivered") || "I delivered the parcel"}
                            </button>
                          )}
                          {ride.deliveredAt && !ride.deliveryConfirmedAt && (
                            <div style={{
                              color: ride.deliveryDisputedAt ? "#f87171" : "#fbbf24",
                              fontSize: 11.5, fontWeight: 700, lineHeight: 1.45,
                            }}>
                              {ride.deliveryDisputedAt
                                ? (t("motari.parcel.owner_disputed") || "The owner says it never arrived. Support will be in touch.")
                                : (t("motari.parcel.waiting_owner") || "The owner has a short while to agree. It stands on its own after that.")}
                            </div>
                          )}
                          {ride.deliveryConfirmedAt && (
                            <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800 }}>
                              ✓ {t("motari.parcel.owner_confirmed") || "The owner confirmed the delivery."}
                            </div>
                          )}
                        </>
                      ) : ride.status === "ASSIGNED" && (
                        <button disabled={busy} onClick={() => act(() => motariArrived(ride.id, token()))} style={cta(!busy)}>
                          {t("motari.dash.btn_arrived") || "I have arrived"}
                        </button>
                      )}
                      {/* Riding starts when the two of them pull away together,
                          so there is nothing to press — just what is happening. */}
                      {ride.kind !== "COURIER" && ride.status === "ARRIVED" && (
                        <div style={{ ...micro, color: "#fbbf24" }}>
                          {t("motari.dash.waiting_to_move") || "Ride starts when you move off together"}
                        </div>
                      )}

                      {ride.kind !== "COURIER" && ride.status === "IN_RIDE" && (
                        ride.destLat != null ? (
                          <div style={{ ...micro }}>
                            {t("motari.dash.auto_complete") || "Finishes on its own at the destination"}
                          </div>
                        ) : (
                          // A destination the map never had cannot be sensed:
                          // this is the one ride that still needs a tap.
                          <button disabled={busy} onClick={() => act(() => motariComplete(ride.id, token()))} style={cta(!busy)}>
                            <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                            {t("motari.dash.btn_complete") || "Complete ride"}
                          </button>
                        )
                      )}

                      {/* However the passenger paid, the platform already knows.
                          The motari only speaks up when the cash never came. */}
                      {ride.status === "COMPLETED" && (
                        ride.paymentStatus === "PAID" ? (
                          <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800 }}>
                            ✓ {ride.paymentMethod === "CASH"
                              ? (t("motari.dash.paid_cash") || "Paid in cash.")
                              : (t("motari.dash.paid_platform") || "Paid via platform. Wallet credited.")}
                          </div>
                        ) : ride.cashDeclaredAt ? (
                          <>
                            <div style={{ color: "#fbbf24", fontSize: 11.5, fontWeight: 700 }}>
                              {t("motari.dash.cash_declared") || "Passenger says they paid cash. It stands shortly unless you say otherwise."}
                            </div>
                            <button disabled={busy} onClick={() => act(() => denyCashPayment(ride.id, token()))} style={{
                              background: "transparent", color: "#f87171", borderRadius: 10, padding: "9px 18px",
                              fontWeight: 800, fontSize: 10.5, border: "1px solid #451a1a", cursor: "pointer",
                              fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase",
                            }}>
                              {t("motari.dash.not_paid") || "I was not paid"}
                            </button>
                          </>
                        ) : (
                          <div style={{ ...micro, color: "#fbbf24" }}>
                            {t("motari.dash.awaiting_payment") || "Waiting for the passenger to pay"}
                          </div>
                        )
                      )}

                      {/* The passenger, as the motari found them. */}
                      {["COMPLETED", "CLOSED"].includes(ride.status) && !ride.passengerRating && (
                        <div>
                          <div style={{ ...micro, marginBottom: 5 }}>
                            {t("motari.dash.rate_passenger") || "Rate this passenger"}
                          </div>
                          <div style={{ display: "flex", gap: 5 }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <button key={n} disabled={busy}
                                onClick={() => act(() => ratePassenger(ride.id, n, token()))}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                                <Star size={22} color="#fbbf24" fill="none" />
                              </button>
                            ))}
                          </div>
                        </div>
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
                      {!online && !mandatoryOnline ? (
                        <button disabled={busy} onClick={() => act(() => setMotariOnline(true, token()))} style={cta(!busy)}>
                          <Power size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 6 }} />
                          {t("motari.dash.go_online") || "Go online"}
                        </button>
                      ) : (
                        <>
                          <div style={{ ...micro, color: "#aaa" }}>
                            {(state?.nearby?.length ?? 0)} {t("motari.dash.seeking") || "passengers seeking"}
                            {gpsError && <span style={{ color: "#f87171" }}> · {gpsError}</span>}
                          </div>
                          {(state?.nearby?.length ?? 0) === 0 ? (
                            <div style={{
                              ...card, textAlign: "center", padding: "16px 14px",
                              border: "1px dashed #333", background: "#141414",
                            }}>
                              <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                                Active On Road · Radar Active
                              </div>
                              <p style={{ color: "#888", fontSize: 11.5, margin: "6px 0 0", lineHeight: 1.5 }}>
                                {t("motari.dash.no_requests") || "No requests around you right now. Stay online, new ride and delivery offers alert here automatically."}
                              </p>
                            </div>
                          ) : (
                            state!.nearby!.map(n => (
                              <div key={n.id} style={{
                                ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                                borderColor: "#333",
                              }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                                    {n.kind === "COURIER" && (
                                      <span style={{
                                        display: "inline-flex", alignItems: "center", gap: 3, marginRight: 6,
                                        background: "#f97316", color: "#000", borderRadius: 5, padding: "1px 6px",
                                        fontSize: 8.5, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase",
                                        verticalAlign: "middle",
                                      }}>
                                        <Package size={9} /> {t("motari.request.courier") || "Courier"}
                                      </span>
                                    )}
                                    {n.pickupName || "Pinned pickup"}
                                    {n.parcelNote && (
                                      <span style={{ display: "block", fontSize: 11, color: "#f97316", fontWeight: 500, marginTop: 1 }}>
                                        {n.parcelNote}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                                    <span style={{ color: "#aaa" }}>{km(n.distanceToPickupM)} away</span> · {n.destName ? `→ ${n.destName}` : (t("motari.dash.open_ride") || "open ride")}
                                    {(n.offeredFareRwf ?? n.quotedFareRwf) != null && (
                                      <b style={{ color: "#f97316" }}>
                                        {" · "}{fmt((n.offeredFareRwf ?? n.quotedFareRwf)!)}
                                        {n.offeredFareRwf != null && ` · ${t("motari.dash.their_price") || "their price"}`}
                                      </b>
                                    )}
                                  </div>
                                </div>
                                <button disabled={busy} onClick={() => act(() => acceptRide(n.id, token()))} style={{
                                  background: "#f97316", color: "#000", borderRadius: 8, padding: "8px 14px",
                                  fontWeight: 900, fontSize: 11, border: "none", cursor: "pointer",
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

                    {/* A bonus waiting to be claimed. Money, but not yet spendable. */}
                    {claimable > 0 && (
                      <div style={{ ...card, padding: "10px 12px", borderColor: "#7c3a10",
                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>
                            {fmt(claimable)} {t("motari.dash.bonus_waiting") || "in bonuses"}
                          </div>
                          <div style={micro}>
                            {t("motari.dash.bonus_hint") || "Claim it into your wallet. It comes out with no fee."}
                          </div>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => act(async () => {
                            await claimBonuses(token());
                            setClaimable(0);
                            return await getMotariState(token());
                          })}
                          style={{
                            borderRadius: 8, padding: "8px 14px", fontSize: 9, fontWeight: 900,
                            letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer",
                            fontFamily: "inherit", background: "#f97316", color: "#000",
                            border: "none", flexShrink: 0,
                          }}
                        >
                          {t("motari.dash.claim") || "Claim"}
                        </button>
                      </div>
                    )}

                    {/* Taking it out. */}
                    {history.walletBalanceRwf > 0 && (
                      <div style={{ ...card, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                              {t("motari.dash.take_out") || "Take money out"}
                            </div>
                            <div style={micro}>
                              {/* Where it goes, said before they press it rather than after. */}
                              {(t("motari.dash.take_out_to") || "To {phone} on {operator}")
                                .replace("{phone}", state?.profile?.payoutPhone || "your number")
                                .replace("{operator}", state?.profile?.payoutOperator || "mobile money")}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                          <input
                            style={{ ...input, flex: 1, padding: "8px 10px" }}
                            placeholder={(t("motari.dash.all_of_it") || "All of it") + ` (${fmt(history.walletBalanceRwf)})`}
                            value={amountOut}
                            onChange={e => setAmountOut(e.target.value.replace(/[^0-9]/g, ""))}
                            inputMode="numeric" maxLength={9}
                          />
                          <button
                            disabled={busy}
                            onClick={() => act(async () => {
                              const r = await withdrawMotariWallet(
                                amountOut ? Number(amountOut) : undefined, token());
                              setAmountOut("");
                              setHistory(await getMotariHistory(token()));
                              return r;
                            })}
                            style={{
                              borderRadius: 8, padding: "8px 16px", fontSize: 9, fontWeight: 900,
                              letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "inherit",
                              cursor: busy ? "not-allowed" : "pointer", flexShrink: 0,
                              background: "#f97316", color: "#000", border: "none",
                            }}
                          >
                            {t("motari.dash.send") || "Send"}
                          </button>
                        </div>
                        <div style={{ ...micro, marginTop: 6 }}>
                          {/* The fee, and the part of the balance it does not apply to. */}
                          {(state?.profile?.bonusFreeRwf ?? 0) > 0
                            ? (t("motari.dash.fee_note_bonus") || "{fee} fee, waived on the first {free} of bonus money.")
                                .replace("{fee}", fmt(state?.profile?.withdrawFeeRwf ?? 0))
                                .replace("{free}", fmt(state?.profile?.bonusFreeRwf ?? 0))
                            : (t("motari.dash.fee_note") || "{fee} fee per withdrawal.")
                                .replace("{fee}", fmt(state?.profile?.withdrawFeeRwf ?? 0))}
                        </div>
                      </div>
                    )}

                    {/* The daily platform fee, always visible here. */}
                    {fees && (
                      <div style={{
                        ...card, padding: "10px 12px",
                        borderColor: fees.paused ? "#7f1d1d" : fees.dueAmountRwf > 0 ? "#7c3a10" : "#1f1f1f",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                              {t("motari.fee.title") || "Daily fee"}
                            </div>
                            <div style={{ ...micro, marginTop: 2 }}>
                              {fees.dueAmountRwf > 0
                                ? `${fmt(fees.dueAmountRwf)} · ${fees.dueDays} ${t("motari.fee.days") || "days"}`
                                : (t("motari.fee.clear") || "Nothing owed")}
                            </div>
                          </div>
                          {fees.dueAmountRwf > 0 && (
                            <button disabled={busy || fees.paymentPending} onClick={payFees} style={{
                              borderRadius: 9, padding: "8px 14px", fontSize: 9.5, fontWeight: 900,
                              letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
                              fontFamily: "inherit", flexShrink: 0, border: "none",
                              background: fees.paymentPending ? "#1a1a1a" : "#f97316",
                              color: fees.paymentPending ? "#888" : "#000",
                            }}>
                              {fees.paymentPending
                                ? (t("motari.fee.pending_short") || "Approve on phone")
                                : (t("motari.fee.pay_now") || "Pay now")}
                            </button>
                          )}
                        </div>
                        <div style={{ ...micro, color: "#555", marginTop: 6 }}>
                          {t("motari.fee.rule") || "Days with fewer rides than the minimum are free."}
                          {" "}{fees.todayRides}/{fees.minRides} {t("motari.dash.rides") || "Rides"} · {fmt(fees.dailyFeeRwf)}
                        </div>
                        {feeError && (
                          <div style={{ color: "#f87171", fontSize: 10.5, marginTop: 6 }}>
                            {feeError} <button onClick={payFees} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 800, padding: 0 }}>
                              {t("motari.fee.try_again") || "Try again"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Where the money goes, and every movement out. */}
                    <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={micro}>{t("motari.dash.paid_out") || "Paid out"}</div>
                        <div style={{ color: "#fff", fontWeight: 900, fontSize: 13, marginTop: 2 }}>
                          {fmt(history.totalPaidOutRwf)}
                        </div>
                      </div>
                      <div style={{ ...micro, textAlign: "right", color: state?.profile?.instantPayout ? "#4ade80" : "#666" }}>
                        {state?.profile?.instantPayout
                          ? (t("motari.dash.instant_on") || "Instant payout on")
                          : (t("motari.dash.instant_off") || "Fares rest in the wallet")}
                        <div style={{ color: "#555" }}>
                          {t("motari.dash.change_in_settings") || "Change in Settings"}
                        </div>
                      </div>
                    </div>

                    {(history.payouts?.length ?? 0) > 0 && (
                      <>
                        <div style={micro}>{t("motari.dash.payout_history") || "Payouts"}</div>
                        {history.payouts.map(p => (
                          <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 12px" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{fmt(p.amountRwf)}</div>
                              <div style={{ ...micro, marginTop: 2 }}>
                                {p.method === "MTN_MOMO" ? "MTN MoMo" : "Airtel Money"} · {p.phone}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{
                                ...micro,
                                color: p.status === "SUCCESS" ? "#4ade80" : p.status === "FAILED" ? "#f87171" : "#fbbf24",
                              }}>
                                {p.status}
                              </div>
                              <div style={{ ...micro, color: "#555" }}>{when(p.createdAt)}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

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
                            <div style={{ fontSize: 10.5, color: "#888", marginTop: 2, lineHeight: 1.5, overflowWrap: "anywhere" }}>
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

                {/* ══ SETTINGS ══ */}
                {tab === "more" && (
                  <div style={{ display: "grid", gap: 10 }}>

                    {/* Bring somebody in. A code two taps away is a code nobody
                        shares, so it sits at the top of the tab a motari opens
                        to look at their own account. */}
                    {rewards?.referral?.code && (
                      <div style={{ ...card, padding: "12px 13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                          <Gift size={12} color="#f97316" />
                          <span style={{ ...micro, color: "#8a8a8a" }}>
                            {t("rewards.bring_someone") || "BRING SOMEONE IN"}
                          </span>
                        </div>

                        <div style={{ color: "#999", fontSize: 11.5, lineHeight: 1.55, marginBottom: 11 }}>
                          {t("rewards.referral_how")
                            || "Give this code to somebody signing up to ride. When they finish their first ride, you are paid."}
                        </div>

                        <div style={{ display: "flex", gap: 7, alignItems: "stretch" }}>
                          <div style={{
                            flex: 1, minWidth: 0, background: "#000",
                            border: "1px solid #f97316", borderRadius: 10,
                            padding: "10px 12px", color: "#fff",
                            fontSize: 17, fontWeight: 900, letterSpacing: 2.5,
                            overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {rewards.referral.code}
                          </div>
                          <button
                            onClick={() => copyInvite(rewards.referral.code)}
                            title={t("rewards.copy") || "Copy the code"}
                            aria-label={t("rewards.copy") || "Copy the code"}
                            style={{
                              border: "1px solid #2a2a2a", background: "none", borderRadius: 10,
                              padding: "0 12px", cursor: "pointer", color: "#888", lineHeight: 0,
                            }}
                          >
                            <Copy size={14} />
                          </button>
                          <a
                            href={inviteWhatsApp(rewards.referral.code)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("rewards.share") || "Share the code"}
                            aria-label={t("rewards.share") || "Share the code"}
                            style={{
                              display: "flex", alignItems: "center",
                              border: "1px solid #2a2a2a", borderRadius: 10,
                              padding: "0 12px", color: "#888",
                            }}
                          >
                            <Share2 size={14} />
                          </a>
                        </div>

                        <div style={{ display: "flex", gap: 14, marginTop: 11 }}>
                          <div>
                            <div style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                              {rewards.referral.invited}
                            </div>
                            <div style={micro}>{t("rewards.invited") || "INVITED"}</div>
                          </div>
                          <div>
                            <div style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                              {rewards.referral.riding}
                            </div>
                            <div style={micro}>{t("rewards.riding") || "RIDING"}</div>
                          </div>
                          <div>
                            <div style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                              {fmt(rewards.referral.earnedRwf)}
                            </div>
                            <div style={micro}>{t("rewards.earned_from") || "EARNED"}</div>
                          </div>
                        </div>

                        {rewards.referral.waiting > 0 && (
                          <div style={{ ...micro, marginTop: 9, lineHeight: 1.5 }}>
                            {(t("rewards.waiting_on_first_ride")
                              || "{count} have signed up but not finished a ride yet. You are paid when they do.")
                              .replace("{count}", String(rewards.referral.waiting))}
                          </div>
                        )}

                        {copied && (
                          <div style={{ color: "#4ade80", fontSize: 11, marginTop: 8 }}>
                            {t("rewards.copied") || "Code copied."}
                          </div>
                        )}
                      </div>
                    )}

                    {state?.profile && (
                      <>
                        {/* Instant payout: on, and to which number */}
                        <div style={{ ...card, padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                                {t("motari.dash.instant_payout") || "Instant payout"}
                              </div>
                              <div style={micro}>
                                {t("motari.dash.instant_hint") || "Platform fares leave for your phone at once"}
                              </div>
                            </div>
                            <button
                              disabled={busy}
                              onClick={() => act(() => setMotariPayout({ instantPayout: !state.profile!.instantPayout }, token()))}
                              style={{
                                borderRadius: 999, padding: "6px 14px", fontSize: 9, fontWeight: 900,
                                letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                                fontFamily: "inherit", flexShrink: 0,
                                background: state.profile.instantPayout ? "#f97316" : "transparent",
                                color: state.profile.instantPayout ? "#000" : "#888",
                                border: state.profile.instantPayout ? "none" : "1px solid #1f1f1f",
                              }}
                            >
                              {state.profile.instantPayout ? (t("motari.dash.on") || "On") : (t("motari.dash.off") || "Off")}
                            </button>
                          </div>

                          {/*
                            Where it goes, stated rather than asked for.

                            This used to open a network picker and a phone box the moment the
                            switch went on: the same number the motari registered with, asked
                            for a second time, with the network they are already on offered as
                            a choice. Two chances to get wrong what the account already knows,
                            and a mistyped payout number sends real money to a stranger. The
                            registered number is used, and 078 and 079 are MTN while 072 and
                            073 are Airtel, which the number itself says.
                          */}
                          {state.profile.instantPayout && (
                            <div style={{ ...micro, marginTop: 9, lineHeight: 1.6 }}>
                              {(t("motari.dash.payout_to") || "Sent to {phone} on {operator}, the number on your account.")
                                .replace("{phone}", state.profile.payoutPhone || "your number")
                                .replace("{operator}", state.profile.payoutOperator || "mobile money")}
                              <div style={{ color: "#555" }}>
                                {t("motari.dash.payout_change") || "To change it, ask support below."}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Carry parcels */}
                        <div style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                              {t("motari.dash.carry_parcels") || "Carry parcels"}
                            </div>
                            <div style={micro}>{t("motari.dash.carry_parcels_hint") || "Courier requests reach you too"}</div>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => act(() => setMotariCourier(!state.profile!.courier, token()))}
                            style={{
                              borderRadius: 999, padding: "6px 14px", fontSize: 9, fontWeight: 900,
                              letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                              fontFamily: "inherit", flexShrink: 0,
                              background: state.profile.courier ? "#f97316" : "transparent",
                              color: state.profile.courier ? "#000" : "#888",
                              border: state.profile.courier ? "none" : "1px solid #1f1f1f",
                            }}
                          >
                            {state.profile.courier ? (t("motari.dash.on") || "On") : (t("motari.dash.off") || "Off")}
                          </button>
                        </div>

                        {/* Account phone: changed by support, not self-served */}
                        <div style={{ ...card, padding: "10px 12px" }}>
                          <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                            {t("motari.dash.phone_change") || "Change account number"}
                          </div>
                          {phoneReqSent ? (
                            <div style={{ color: "#4ade80", fontSize: 11.5, marginTop: 5 }}>
                              {t("motari.dash.phone_change_sent") || "Sent. Support will confirm the change."}
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                              <input
                                style={{ ...input, flex: 1, padding: "8px 10px" }}
                                placeholder="07xxxxxxxx"
                                value={phoneReq}
                                onChange={e => setPhoneReq(formatRwPhone(e.target.value))}
                                inputMode="numeric" maxLength={10}
                              />
                              <button
                                disabled={busy || !isValidRwPhone(phoneReq)}
                                onClick={requestPhoneChange}
                                style={{
                                  borderRadius: 8, padding: "8px 14px", fontSize: 9, fontWeight: 900,
                                  letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "inherit",
                                  cursor: isValidRwPhone(phoneReq) ? "pointer" : "not-allowed",
                                  background: isValidRwPhone(phoneReq) ? "#f97316" : "#1a1a1a",
                                  color: isValidRwPhone(phoneReq) ? "#000" : "#555", border: "none", flexShrink: 0,
                                }}
                              >
                                {t("motari.dash.request") || "Request"}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Complaint */}
                    <div style={{ ...card, padding: "10px 12px" }}>
                      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        {t("motari.dash.complaint") || "Raise a complaint"}
                      </div>
                      {complaintSent ? (
                        <div style={{ fontSize: 11.5, color: "#4ade80" }}>
                          {t("motari.dash.complaint_sent") || "Sent. Support will reach out."}
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 7 }}>
                          <textarea
                            style={{ ...input, minHeight: 58, resize: "vertical", padding: "8px 10px" }}
                            placeholder={t("motari.dash.complaint_ph") || "Tell us what happened"}
                            value={complaint}
                            onChange={e => setComplaint(e.target.value)}
                            maxLength={2000}
                          />
                          <button disabled={busy || complaint.trim().length < 10} onClick={sendComplaint}
                                  style={cta(!busy && complaint.trim().length >= 10)}>
                            {t("motari.dash.complaint_cta") || "Send complaint"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
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

        <InstallPrompt appName="Motari" />
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
