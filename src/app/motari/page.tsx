"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MotariMap, type MapPoint } from "@/components/motari/MotariMap";
import { MotariRegisterModal } from "@/components/motari/MotariRegisterModal";
import { MotariLoginModal } from "@/components/motari/MotariLoginModal";
import { searchPlaces, reverseGeocode, type PlaceSuggestion } from "@/lib/geocoding";
import { getRoute, fmtDistance, fmtDuration, type RouteResult } from "@/lib/routing";
import {
  getRideQuote, requestRide, trackRide, cancelRide, rateRide, payRideNow,
  getMotariSupply, apiError,
  type RideQuote, type RideDto, type RideKind, type MotariSupply,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { playSound, unlockSounds } from "@/lib/sounds";
import { formatRwPhone, isValidRwPhone } from "@/lib/phone";
import {
  Menu, X, MapPin, Flag, Phone, User, Star, ChevronDown, ChevronUp,
  LocateFixed, Home, Users, HelpCircle, Bike, Globe, LogIn, LogOut, LayoutDashboard, Pencil, Check, Package,
} from "lucide-react";

const ACTIVE_TOKEN_KEY = "motari_ride_token";
const POLL_MS = 4000;
const TERMINAL = ["CLOSED", "CANCELLED", "NO_MATCH"];

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const km = (m?: number) => `${((m ?? 0) / 1000).toFixed(1)} km`;

interface Picked extends MapPoint { label: string; }

/**
 * Ask Motari — one full-screen map. The site chrome collapses to a hamburger;
 * everything the passenger does lives in a minimizable bottom sheet: type a
 * pickup and (optional) destination, watch the pins drop and the route draw,
 * request, then track the accepted motari on the same map.
 */
export default function AskMotariPage() {
  const { t, language, setLanguage } = useLanguage();

  // menu + sheet chrome
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // /motari?register=1 (footer and signup links) opens the motari signup modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("register") === "1") {
      setRegisterOpen(true);
    }
  }, []);

  // A signed-in visitor sees their account in the menu instead of the two ways in.
  const [account, setAccount] = useState<{ name: string; role: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      if (u?.name && localStorage.getItem("access_token")) {
        setAccount({ name: u.name, role: u.role ?? "WORKER" });
      }
    } catch { /* unreadable session: treat as signed out */ }
  }, []);

  const signOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setAccount(null);
    setMenuOpen(false);
  };

  // request form
  const [pickup, setPickup] = useState<Picked | null>(null);
  const [dest, setDest] = useState<Picked | null>(null);
  const [pickupQ, setPickupQ] = useState("");
  const [destQ, setDestQ] = useState("");
  const [pickupSug, setPickupSug] = useState<PlaceSuggestion[]>([]);
  const [destSug, setDestSug] = useState<PlaceSuggestion[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [locating, setLocating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [offerFare, setOfferFare] = useState("");
  const [editingFare, setEditingFare] = useState(false);

  // Passenger or parcel. Courier keeps its own minimum fare.
  const [kind, setKind] = useState<RideKind>("RIDE");
  const [parcelNote, setParcelNote] = useState("");
  const [supply, setSupply] = useState<MotariSupply | null>(null);

  // payment choice once a motari accepted: platform prompt or cash
  const [payOpen, setPayOpen] = useState(false);
  const [payPhone, setPayPhone] = useState("");
  const [payChoice, setPayChoice] = useState<"" | "cash">("");
  const [paying, setPaying] = useState(false);
  const [quote, setQuote] = useState<RideQuote | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // live ride
  const [ride, setRide] = useState<RideDto | null>(null);
  const [stars, setStars] = useState(0);
  const tokenRef = useRef<string | null>(null);

  // Live device position: watched continuously, so the blue dot always shows
  // where the phone actually is and keeps refreshing as it moves.
  const [device, setDevice] = useState<MapPoint | null>(null);
  const [deviceAcc, setDeviceAcc] = useState<number | null>(null);
  const deviceRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => {
        // An accuracy in the kilometres is an IP-level guess, not a GPS fix.
        if (p.coords.accuracy != null && p.coords.accuracy > 5000) return;
        deviceRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
        setDevice({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setDeviceAcc(p.coords.accuracy ?? null);
      },
      () => { /* permission denied or unavailable: the dot simply stays hidden */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* ── notification sounds ───────────────────────────────────────────────── */
  // Browsers only allow audio after a gesture, so prime the clips on first tap.
  useEffect(() => {
    const once = () => unlockSounds();
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => {
      window.removeEventListener("pointerdown", once);
      window.removeEventListener("keydown", once);
    };
  }, []);

  // Announce what just changed: a motari accepted, they arrived, the fare was
  // paid, or the ride ended without one.
  const prevStatus = useRef<string | null>(null);
  const prevPaid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!ride) { prevStatus.current = null; prevPaid.current = undefined; return; }
    const before = prevStatus.current;
    if (before && before !== ride.status) {
      if (ride.status === "ASSIGNED") playSound("accepted");
      else if (["ARRIVED", "CANCELLED", "NO_MATCH", "CLOSED"].includes(ride.status)) {
        playSound("payment-arrived-canceled");
      }
    }
    if (prevPaid.current !== "PAID" && ride.paymentStatus === "PAID") {
      playSound("payment-arrived-canceled");
    }
    prevStatus.current = ride.status;
    prevPaid.current = ride.paymentStatus;
  }, [ride?.status, ride?.paymentStatus, ride]);

  /* ── resume an active ride ─────────────────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem(ACTIVE_TOKEN_KEY);
    if (!token) return;
    trackRide(token)
      .then(r => {
        if (TERMINAL.includes(r.status)) { localStorage.removeItem(ACTIVE_TOKEN_KEY); return; }
        tokenRef.current = token;
        setRide(r);
      })
      .catch(() => localStorage.removeItem(ACTIVE_TOKEN_KEY));
  }, []);

  /* ── poll while a ride is live ─────────────────────────────────────────── */
  useEffect(() => {
    if (!ride || TERMINAL.includes(ride.status) || !tokenRef.current) return;
    const id = setInterval(async () => {
      try {
        const r = await trackRide(tokenRef.current!);
        setRide(r);
        if (TERMINAL.includes(r.status)) localStorage.removeItem(ACTIVE_TOKEN_KEY);
      } catch { /* transient network — keep last state */ }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [ride?.status, ride]);

  /* ── type-ahead: search as the user types, biased to where they are ────── */
  useEffect(() => {
    if (pickup && pickupQ === pickup.label) { setPickupSug([]); setSearchingPickup(false); return; }
    if (pickupQ.trim().length < 2) { setPickupSug([]); setSearchingPickup(false); return; }
    setSearchingPickup(true);
    const id = setTimeout(() => {
      searchPlaces(pickupQ, deviceRef.current
        ? { latitude: deviceRef.current.lat, longitude: deviceRef.current.lng } : null)
        .then(setPickupSug)
        .finally(() => setSearchingPickup(false));
    }, 300);
    return () => clearTimeout(id);
  }, [pickupQ, pickup]);

  useEffect(() => {
    if (dest && destQ === dest.label) { setDestSug([]); setSearchingDest(false); return; }
    if (destQ.trim().length < 2) { setDestSug([]); setSearchingDest(false); return; }
    setSearchingDest(true);
    const id = setTimeout(() => {
      // Bias destinations around the pickup, else around the device.
      const near = pickup ?? (deviceRef.current
        ? { latitude: deviceRef.current.lat, longitude: deviceRef.current.lng } : null);
      searchPlaces(destQ, near)
        .then(setDestSug)
        .finally(() => setSearchingDest(false));
    }, 300);
    return () => clearTimeout(id);
  }, [destQ, dest, pickup]);

  /* ── how much supply is around, per kind ───────────────────────────────── */
  useEffect(() => {
    const at = pickup ?? device;
    if (!at) { setSupply(null); return; }
    let alive = true;
    const load = () => getMotariSupply({ lat: at.latitude, lng: at.longitude }, kind)
      .then(s => { if (alive) setSupply(s); })
      .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [kind, pickup, device]);

  /* ── quote + road route once points exist ──────────────────────────────── */
  useEffect(() => {
    if (!pickup) { setQuote(null); setRoute(null); return; }
    getRideQuote(
      { lat: pickup.latitude, lng: pickup.longitude },
      dest ? { lat: dest.latitude, lng: dest.longitude } : null,
      kind,
    ).then(setQuote).catch(() => setQuote(null));
    if (dest) {
      getRoute(pickup, dest).then(setRoute);
    } else {
      setRoute(null);
    }
  }, [pickup, dest, kind]);

  const useMyLocation = async () => {
    // The continuous watch usually already holds a fresh, accurate fix: use it
    // instantly instead of waiting for a new one-shot reading.
    const fix = deviceRef.current;
    if (fix) {
      setLocating(true);
      const loc = await reverseGeocode(fix.lat, fix.lng);
      const label = loc.address.split(",").slice(0, 2).join(",").trim();
      setPickup({ latitude: fix.lat, longitude: fix.lng, label });
      setPickupQ(label);
      setLocating(false);
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async p => {
        const loc = await reverseGeocode(p.coords.latitude, p.coords.longitude);
        const label = loc.address.split(",").slice(0, 2).join(",").trim();
        setPickup({ latitude: p.coords.latitude, longitude: p.coords.longitude, label });
        setPickupQ(label);
        setLocating(false);
      },
      () => { setError(t("motari.request.gps_denied") || "Could not read your location. Type your pickup instead."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const pickOnMap = useCallback(async (p: MapPoint) => {
    // Tap-to-pin fills whichever point is still missing: pickup first, then destination.
    const loc = await reverseGeocode(p.latitude, p.longitude);
    const label = loc.address.split(",").slice(0, 2).join(",").trim();
    if (!pickup) { setPickup({ ...p, label }); setPickupQ(label); }
    else if (!dest) { setDest({ ...p, label }); setDestQ(label); }
  }, [pickup, dest]);

  // A parcel has a floor: the passenger must name at least the minimum.
  const courierMin = supply?.minFareRwf ?? quote?.minFareRwf ?? 1000;
  const priced = parseInt(offerFare || "0", 10);
  // A parcel must say where it is going, and clear the courier floor.
  const courierOk = kind !== "COURIER" || (!!dest && priced >= courierMin);
  const canSubmit = !!pickup && name.trim().length >= 2 && isValidRwPhone(phone) && courierOk && !busy;

  const submit = async () => {
    if (!canSubmit || !pickup) return;
    setBusy(true);
    setError("");
    try {
      const r = await requestRide({
        name: name.trim(),
        phone: phone.trim(),
        pickupLat: pickup.latitude, pickupLng: pickup.longitude, pickupName: pickup.label,
        ...(dest ? { destLat: dest.latitude, destLng: dest.longitude, destName: dest.label } : {}),
        ...(parseInt(offerFare || "0", 10) > 0 ? { offeredFareRwf: parseInt(offerFare, 10) } : {}),
        ...(kind === "COURIER" ? { kind, parcelNote: parcelNote.trim() || undefined } : {}),
      });
      if (r.token) { localStorage.setItem(ACTIVE_TOKEN_KEY, r.token); tokenRef.current = r.token; }
      setRide(r);
      setMinimized(false);
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const doCancel = async () => {
    if (!tokenRef.current) return;
    setBusy(true);
    try {
      const r = await cancelRide(tokenRef.current);
      setRide(r);
      localStorage.removeItem(ACTIVE_TOKEN_KEY);
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const doPayNow = async () => {
    if (!tokenRef.current || paying) return;
    setPaying(true);
    setError("");
    try {
      setRide(await payRideNow(tokenRef.current, payPhone.trim()));
      setPayOpen(false);
    } catch (e) { setError(apiError(e)); }
    setPaying(false);
  };

  const doRate = async (n: number) => {
    if (!tokenRef.current) return;
    setStars(n);
    try { setRide(await rateRide(tokenRef.current, n)); } catch (e) { setError(apiError(e)); }
  };

  const reset = () => {
    setRide(null); setStars(0); setError("");
    tokenRef.current = null;
    localStorage.removeItem(ACTIVE_TOKEN_KEY);
  };

  /* ── what the map shows ────────────────────────────────────────────────── */
  const mapPickup: MapPoint | null = ride ? { latitude: ride.pickupLat, longitude: ride.pickupLng } : pickup;
  const mapDest: MapPoint | null = ride
    ? (ride.destLat != null && ride.destLng != null ? { latitude: ride.destLat, longitude: ride.destLng } : null)
    : dest;
  const mapDriver: MapPoint | null =
    ride?.driver?.latitude != null && ride?.driver?.longitude != null && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status)
      ? { latitude: ride.driver.latitude, longitude: ride.driver.longitude }
      : null;

  const meteredSoFar = ride && ride.fareMode === "METERED"
    ? Math.max(ride.minFareRwf, Math.round((ride.baseFareRwf + ride.perKmRwf * (ride.riddenDistanceM ?? 0) / 1000) / 100) * 100)
    : null;

  const statusTitle: Record<string, string> = {
    SEARCHING: t("motari.ride.searching") || "Finding your moto…",
    ASSIGNED: t("motari.ride.assigned") || "Your motari is coming",
    ARRIVED: t("motari.ride.arrived") || "He's here. Check the plate.",
    IN_RIDE: t("motari.ride.in_ride") || "On the move",
    COMPLETED: t("motari.ride.completed") || "You've arrived. Pay now.",
    CLOSED: t("motari.ride.closed") || "Done. Thanks for riding.",
    CANCELLED: t("motari.ride.cancelled") || "Ride cancelled",
    NO_MATCH: t("motari.ride.no_match") || "No moto nearby right now",
  };

  const summaryLine = ride
    ? statusTitle[ride.status]
    : pickup
      ? (dest ? `${pickup.label} → ${dest.label}` : pickup.label)
      : (t("motari.request.set_pickup") || "Set your pickup");

  /* ── styles: true black, small sharp type ──────────────────────────────── */
  const glass: React.CSSProperties = {
    background: "rgba(0,0,0,0.94)", backdropFilter: "blur(12px)",
    border: "1px solid #1f1f1f",
  };
  const micro: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "#666",
  };
  const input: React.CSSProperties = {
    width: "100%", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 9,
    padding: "9px 10px 9px 30px", color: "#fff", fontSize: 12, fontWeight: 500,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };
  const iconLeft: React.CSSProperties = {
    position: "absolute", left: 10, top: 17, transform: "translateY(-50%)",
  };
  const suggestBox: React.CSSProperties = {
    position: "absolute", left: 0, right: 0, top: 38, zIndex: 30,
    background: "#0a0a0a", border: "1px solid #262626", borderRadius: 10, overflow: "hidden",
    boxShadow: "0 12px 32px rgba(0,0,0,0.85)",
  };
  const suggestItem: React.CSSProperties = {
    display: "block", width: "100%", textAlign: "left", padding: "9px 13px",
    background: "none", border: "none", borderBottom: "1px solid #1a1a1a",
    color: "#eee", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
  };
  const cta = (enabled: boolean, bg = "#f97316"): React.CSSProperties => ({
    width: "100%", background: enabled ? bg : "#1a1a1a",
    color: enabled ? "#000" : "#555", borderRadius: 10, padding: "10px 20px",
    fontWeight: 900, fontSize: 11, letterSpacing: "0.04em", border: "none",
    cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit",
    textTransform: "uppercase",
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000", overflow: "hidden",
      display: "flex", justifyContent: "center",
    }}>
      {/* App frame: phone-width column, centered — the experience never
          stretches to desktop width; on small screens it IS the screen. */}
      <div className="motari-frame" style={{
        position: "relative", width: "100%", maxWidth: 480, height: "100%",
        background: "#000", overflow: "hidden",
      }}>

      {/* MAP — fills the app frame */}
      <MotariMap
        pickup={mapPickup}
        destination={mapDest}
        driver={mapDriver}
        self={device}
        selfAccuracyM={deviceAcc}
        route={!ride && route ? route.coordinates : null}
        onPick={ride ? undefined : pickOnMap}
      />

      {/* HAMBURGER — the topbar, folded into three lines */}
      <div style={{ position: "absolute", top: 14, left: 14, zIndex: 1000 }}>
        <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" style={{
          ...glass, width: 32, height: 32, borderRadius: 9, display: "flex",
          alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#eee",
        }}>
          {menuOpen ? <X size={14} /> : <Menu size={14} />}
        </button>
        {menuOpen && (
          /* Anchored below the button so opening it never shifts the layout. */
          <div style={{
            ...glass, position: "absolute", top: 40, left: 0,
            borderRadius: 12, overflow: "hidden", width: 168,
          }}>
            {/* Signed in: the account itself, its dashboard and a way out.
                Signed out: the two ways in. */}
            {account && (
              <div style={{ padding: "10px 13px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: "50%", background: "#f97316", color: "#000",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 11, flexShrink: 0,
                }}>
                  {(account.name || "?").charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 11, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {account.name}
                  </div>
                  <div style={{ ...micro, fontSize: 8 }}>
                    {account.role === "MOTARI" ? "Motari"
                      : account.role === "EMPLOYER" ? (t("common.nav.employer") || "Employer")
                      : (t("common.nav.job_seeker") || "Job seeker")}
                  </div>
                </div>
              </div>
            )}
            {([
              { href: "/", Icon: Home, label: t("common.nav.home") || "Home" },
              { href: "/browse", Icon: Users, label: t("common.nav.browse") || "Browse workers" },
              ...(account
                ? [
                    { href: account.role === "MOTARI" ? "/drive" : account.role === "EMPLOYER" ? "/owner" : "/seeker",
                      Icon: LayoutDashboard, label: t("common.nav.dashboard") || "Dashboard" },
                    { onClick: signOut, Icon: LogOut, label: t("common.nav.sign_out") || "Sign out" },
                  ]
                : [
                    { onClick: () => { setRegisterOpen(true); setMenuOpen(false); }, Icon: Bike, label: t("motari.menu.register") || "Register as motari" },
                    // Motari sign in right here; the modal routes each role to its dashboard.
                    { onClick: () => { setLoginOpen(true); setMenuOpen(false); }, Icon: LogIn, label: t("common.nav.signin") || "Sign in" },
                  ]),
              { href: "/help", Icon: HelpCircle, label: t("common.nav.help") || "Help" },
            ] as { href?: string; onClick?: () => void; Icon: typeof Home; label: string }[]).map(({ href, onClick, Icon, label }) => {
              const style: React.CSSProperties = {
                display: "flex", alignItems: "center", gap: 9, padding: "10px 13px",
                color: "#ccc", fontSize: 11, fontWeight: 600, textDecoration: "none",
                borderBottom: "1px solid #1a1a1a", width: "100%", background: "none",
                border: "none", borderBottomWidth: 1, borderBottomStyle: "solid",
                borderBottomColor: "#1a1a1a", cursor: "pointer", fontFamily: "inherit",
                textAlign: "left",
              };
              return href ? (
                <a key={label} href={href} style={style}>
                  <Icon size={13} color="#f97316" /> {label}
                </a>
              ) : (
                <button key={label} onClick={onClick} style={style}>
                  <Icon size={13} color="#f97316" /> {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* LANGUAGE — top right */}
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 1000 }}>
        <button onClick={() => setLangOpen(o => !o)} aria-label="Language" style={{
          ...glass, height: 32, borderRadius: 9, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 5, cursor: "pointer", color: "#fff",
          padding: "0 10px", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em",
          textTransform: "uppercase", fontFamily: "inherit",
        }}>
          <Globe size={12} color="#f97316" />
          {language === "kinyy" ? "RW" : language.toUpperCase()}
        </button>
        {langOpen && (
          /* Anchored to the button's right edge so opening it never moves the button. */
          <div style={{
            ...glass, position: "absolute", top: 40, right: 0,
            borderRadius: 12, overflow: "hidden", width: 128,
          }}>
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

      {/* Brand chip, top center */}
      <div style={{
        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 999,
        ...glass, borderRadius: 999, padding: "7px 13px",
        display: "flex", alignItems: "center", gap: 6, color: "#fff", fontWeight: 800,
        fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
      }}>
        <Bike size={11} color="#f97316" />
        {t("common.buttons.ask_motari") || "Ask Motari"}
      </div>

      {/* BOTTOM SHEET */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1000,
        display: "flex", justifyContent: "center", pointerEvents: "none",
      }}>
        <div style={{
          ...glass, pointerEvents: "auto", width: "100%", maxWidth: 560,
          borderRadius: "20px 20px 0 0", borderBottom: "none",
          padding: minimized ? "8px 14px 12px" : "8px 14px 16px",
          maxHeight: "72dvh", overflowY: "auto", overflowX: "hidden",
        }}>
          {/* handle + minimize toggle */}
          <button
            onClick={() => setMinimized(m => !m)}
            aria-label={minimized ? "Expand" : "Minimize"}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              width: "100%", background: "none", border: "none", cursor: "pointer",
              padding: "2px 0 8px", color: "#666", fontFamily: "inherit",
            }}
          >
            <span style={{ width: 34, height: 3, borderRadius: 999, background: "#333" }} />
            {minimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* minimized: one-line summary */}
          {minimized ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: "0.01em" }}>
              {ride && ["SEARCHING"].includes(ride.status) && (
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #2a2a2a", borderTopColor: "#f97316", animation: "mspin 1s linear infinite", flexShrink: 0 }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summaryLine}</span>
              {ride?.driver && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <span style={{ marginLeft: "auto", color: "#f97316", flexShrink: 0 }}>{ride.driver.plateNumber}</span>
              )}
            </div>
          ) : !ride ? (
            /* ── REQUEST FORM ─────────────────────────────────────────────── */
            <>
              {/* Ride or parcel, with how much supply is actually around. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                {([
                  ["RIDE", Bike, t("common.buttons.ask_motari") || "Ask Motari"],
                  ["COURIER", Package, t("motari.request.courier") || "Courier"],
                ] as const).map(([k, Icon, label]) => (
                  <button
                    key={k}
                    onClick={() => { setKind(k); if (k === "RIDE") setParcelNote(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 9.5, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase",
                      background: kind === k ? "#f97316" : "transparent",
                      color: kind === k ? "#000" : "#777",
                      border: kind === k ? "none" : "1px solid #1f1f1f",
                    }}
                  >
                    <Icon size={11} /> {label}
                  </button>
                ))}
                {supply && (
                  <span style={{ ...micro, marginLeft: "auto", color: supply.active > 0 ? "#4ade80" : "#666" }}>
                    {supply.active} {t("motari.request.available") || "available"}
                    {supply.nearestM != null && ` · ${km(supply.nearestM)}`}
                  </span>
                )}
              </div>

              {/* pickup */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <MapPin size={12} color="#f97316" style={iconLeft} />
                <input
                  style={input}
                  placeholder={t("motari.request.pickup_placeholder") || "From"}
                  value={pickupQ}
                  onChange={e => { setPickupQ(e.target.value); if (pickup) setPickup(null); }}
                />
                <button onClick={useMyLocation} disabled={locating} aria-label="Use my location" style={{
                  position: "absolute", right: 6, top: 17, transform: "translateY(-50%)",
                  background: "#232323", border: "1px solid #333", borderRadius: 9,
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: locating ? "#666" : "#f97316",
                }}>
                  <LocateFixed size={12} />
                </button>
                {(searchingPickup || (pickupSug.length === 0 && pickupQ.trim().length >= 2 && !pickup)) && (
                  <div style={{ ...suggestBox, padding: "10px 13px", fontSize: 11.5, color: "#666" }}>
                    {searchingPickup
                      ? (t("motari.request.searching") || "Searching…")
                      : (t("motari.request.no_match") || "No match. Tap the map to drop a pin.")}
                  </div>
                )}
                {pickupSug.length > 0 && (
                  <div style={suggestBox}>
                    {pickupSug.map((s, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setPickup({ latitude: s.latitude, longitude: s.longitude, label: s.label });
                        setPickupQ(s.label);
                        setPickupSug([]);
                      }}>
                        <b>{s.label}</b>
                        <span style={{ display: "block", color: "#777", fontSize: 11.5, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* destination (optional) */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Flag size={12} color={kind === "COURIER" && !dest ? "#f97316" : "#16a34a"} style={iconLeft} />
                <input
                  // A parcel's destination is required: the field says so until it is picked.
                  style={kind === "COURIER" && !dest ? { ...input, borderColor: "#7c3a10" } : input}
                  placeholder={kind === "COURIER"
                    ? (t("motari.request.destination_required") || "To (required for parcels)")
                    : (t("motari.request.destination_placeholder") || "To (optional)")}
                  value={destQ}
                  onChange={e => { setDestQ(e.target.value); if (dest) setDest(null); }}
                />
                {dest && (
                  <button onClick={() => { setDest(null); setDestQ(""); }} aria-label="Clear destination" style={{
                    position: "absolute", right: 6, top: 17, transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#666",
                  }}>
                    <X size={13} />
                  </button>
                )}
                {(searchingDest || (destSug.length === 0 && destQ.trim().length >= 2 && !dest)) && (
                  <div style={{ ...suggestBox, padding: "10px 13px", fontSize: 11.5, color: "#666" }}>
                    {searchingDest
                      ? (t("motari.request.searching") || "Searching…")
                      : (t("motari.request.no_match") || "No match. Tap the map to drop a pin.")}
                  </div>
                )}
                {destSug.length > 0 && (
                  <div style={suggestBox}>
                    {destSug.map((s, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setDest({ latitude: s.latitude, longitude: s.longitude, label: s.label });
                        setDestQ(s.label);
                        setDestSug([]);
                      }}>
                        <b>{s.label}</b>
                        <span style={{ display: "block", color: "#777", fontSize: 11.5, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* trip chips: km · min · fare */}
              {quote && pickup && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {route && (
                    <>
                      <span style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 999, padding: "5px 11px", fontSize: 11, color: "#aaa", fontWeight: 800, letterSpacing: "0.04em" }}>
                        {fmtDistance(route.distanceM)}
                      </span>
                      <span style={{ background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 999, padding: "5px 11px", fontSize: 11, color: "#aaa", fontWeight: 800, letterSpacing: "0.04em" }}>
                        {fmtDuration(route.durationS)}
                      </span>
                    </>
                  )}
                  {/* No destination means no distance to price: the passenger
                      simply says what they will pay. A parcel always names a
                      price, and it cannot go below the courier minimum. */}
                  {(kind === "COURIER" || !dest) && parseInt(offerFare || "0", 10) <= 0 ? (
                    <>
                      <input
                        style={{ ...input, width: 190, padding: "7px 12px" }}
                        value={offerFare}
                        onChange={e => setOfferFare(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric" maxLength={7}
                        placeholder={kind === "COURIER"
                          ? `${t("motari.request.name_price") || "What will you pay? RWF"} (min ${courierMin.toLocaleString()})`
                          : (t("motari.request.name_price") || "What will you pay? RWF")}
                      />
                      {kind === "COURIER" && (
                        <span style={{ ...micro, color: "#666" }}>
                          {t("motari.request.courier_min") || "Parcels start at"} {fmt(courierMin)}
                        </span>
                      )}
                    </>
                  ) : !editingFare ? (
                    <>
                      <span style={{ background: "#f97316", borderRadius: 999, padding: "5px 12px", fontSize: 11.5, color: "#000", fontWeight: 900, letterSpacing: "0.03em" }}>
                        {parseInt(offerFare || "0", 10) > 0
                          ? fmt(parseInt(offerFare, 10))
                          : quote.quotedFareRwf
                            ? fmt(quote.quotedFareRwf)
                            : `${fmt(quote.baseFareRwf)} + ${fmt(quote.perKmRwf)}/km`}
                      </span>
                      {/* The calculated price is a starting point: too big or too
                          small, the passenger edits it into their own offer. */}
                      <button
                        onClick={() => {
                          if (!offerFare && quote.quotedFareRwf) setOfferFare(String(quote.quotedFareRwf));
                          setEditingFare(true);
                        }}
                        aria-label={t("motari.request.edit_price") || "Edit price"}
                        style={{
                          background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 999,
                          width: 26, height: 26, display: "flex", alignItems: "center",
                          justifyContent: "center", cursor: "pointer", color: "#f97316",
                        }}
                      >
                        <Pencil size={11} />
                      </button>
                      <span style={{ ...micro, marginLeft: 2 }}>
                        {parseInt(offerFare || "0", 10) > 0
                          ? (t("motari.request.your_price") || "Your price.")
                          : (t("motari.request.no_haggle") || "Fixed. No haggling.")}
                      </span>
                    </>
                  ) : (
                    <>
                      <input
                        style={{ ...input, width: 120, padding: "6px 10px" }}
                        value={offerFare}
                        onChange={e => setOfferFare(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric" maxLength={7} autoFocus
                        placeholder="RWF"
                        onKeyDown={e => e.key === "Enter" && setEditingFare(false)}
                      />
                      <button onClick={() => setEditingFare(false)} aria-label="Apply" style={{
                        background: "#f97316", border: "none", borderRadius: 999, width: 26, height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#000",
                      }}>
                        <Check size={13} />
                      </button>
                      <button onClick={() => { setOfferFare(""); setEditingFare(false); }} aria-label="Reset" style={{
                        background: "none", border: "1px solid #1f1f1f", borderRadius: 999, width: 26, height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#888",
                      }}>
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* what is being sent (courier only) */}
              {kind === "COURIER" && (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <Package size={12} color="#f97316" style={iconLeft} />
                  <input
                    style={input}
                    placeholder={t("motari.request.parcel_note") || "What are you sending? (optional)"}
                    value={parcelNote}
                    onChange={e => setParcelNote(e.target.value)}
                    maxLength={255}
                  />
                </div>
              )}

              {/* contact */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ position: "relative" }}>
                  <User size={12} color="#555" style={iconLeft} />
                  <input style={input} placeholder={t("motari.request.your_name") || "Your name"}
                         value={name} onChange={e => setName(e.target.value)} maxLength={120} />
                </div>
                <div style={{ position: "relative" }}>
                  <Phone size={12} color="#555" style={iconLeft} />
                  <input style={input} placeholder={t("motari.request.your_phone") || "07xx…"}
                         value={phone} onChange={e => setPhone(formatRwPhone(e.target.value))} inputMode="numeric" maxLength={10} />
                </div>
              </div>

              {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</div>}

              <button onClick={submit} disabled={!canSubmit} style={cta(canSubmit)}>
                {busy
                  ? (t("motari.request.requesting") || "Requesting…")
                  : !pickup
                    ? (t("motari.request.set_pickup_first") || "Set your pickup")
                    : kind === "COURIER" && !dest
                      // Typed but unpicked is the common trap: say so explicitly.
                      ? destQ.trim().length >= 2
                        ? (t("motari.request.pick_destination") || "Pick the destination from the list")
                        : (t("motari.request.set_destination") || "Set the destination")
                    : !courierOk
                      ? `${t("motari.request.courier_min") || "Parcels start at"} ${fmt(courierMin)}`
                      : kind === "COURIER"
                        ? (t("motari.request.send_parcel") || "Send parcel")
                        : (t("common.buttons.ask_motari") || "Ask Motari")}
              </button>

              <div style={{ ...micro, textAlign: "center", marginTop: 10, color: "#555" }}>
                {t("motari.request.trust") || "Verified drivers · Plates you can check · Cash or MoMo"}
              </div>
            </>
          ) : (
            /* ── LIVE RIDE ────────────────────────────────────────────────── */
            <>
              {["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <div style={{ ...micro, color: "#f97316", marginBottom: 4 }}>
                  {t("motari.ride.ongoing") || "Ongoing trip"}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                {ride.status === "SEARCHING" && (
                  <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid #2a2a2a", borderTopColor: "#f97316", animation: "mspin 1s linear infinite", flexShrink: 0 }} />
                )}
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 15, letterSpacing: "-0.01em" }}>{statusTitle[ride.status]}</div>
                {ride.status === "SEARCHING" && (
                  <span style={{ marginLeft: "auto", color: "#666", fontSize: 11, fontWeight: 700 }}>
                    {ride.searchRadiusKm != null && `${t("motari.ride.scanning") || "Scanning"} ${ride.searchRadiusKm} km`}
                    {typeof ride.searchSecondsLeft === "number" && ` · ${Math.ceil(ride.searchSecondsLeft)}s`}
                  </span>
                )}
              </div>

              {/* From / To timeline */}
              <div style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", padding: "11px 2px", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
                    <span style={{ width: 1, height: 26, borderLeft: "2px dotted #333", margin: "3px 0" }} />
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: "transparent", border: "2px solid #fff", flexShrink: 0 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...micro, marginBottom: 1 }}>{t("motari.ride.from") || "From"}</div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {ride.pickupName || "Pinned pickup"}
                    </div>
                    <div style={{ ...micro, margin: "11px 0 1px" }}>{t("motari.ride.to") || "To"}</div>
                    <div style={{ color: ride.destName ? "#fff" : "#888", fontSize: 12, fontWeight: 600, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {ride.destName || (t("motari.ride.open_destination") || "Tell your driver. The meter keeps it fair.")}
                    </div>
                  </div>
                </div>
              </div>

              {/* driver card */}
              {ride.driver && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  {ride.driver.photoUrl
                    ? <img src={ride.driver.photoUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #f97316" }} />
                    : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#000", flexShrink: 0 }}>
                        {ride.driver.name?.[0] ?? "M"}
                      </div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#fff" }}>
                      {ride.driver.name}
                      {ride.driver.brandModel && (
                        <span style={{ color: "#888", fontWeight: 600, fontSize: 11, marginLeft: 7 }}>{ride.driver.brandModel}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
                      {/* The plate is the trust anchor — it reads loudest in the card. */}
                      <span style={{ background: "#fff", borderRadius: 5, padding: "2px 9px", fontWeight: 900, color: "#000", letterSpacing: "0.08em", fontSize: 12 }}>
                        {ride.driver.plateNumber || "—"}
                      </span>
                      {typeof ride.driver.rating === "number" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700 }}>
                          <Star size={10} color="#fbbf24" fill="#fbbf24" /> {ride.driver.rating.toFixed(1)}
                        </span>
                      )}
                      <span style={micro}>{t("motari.ride.verified") || "Verified"}</span>
                    </div>
                  </div>
                  {ride.driver.phone && (
                    <a href={`tel:${ride.driver.phone}`} aria-label="Call driver" style={{
                      background: "#f97316", borderRadius: "50%", width: 40, height: 40,
                      display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", flexShrink: 0,
                    }}>
                      <Phone size={16} color="#fff" />
                    </a>
                  )}
                </div>
              )}

              {/* fare line */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12, padding: "10px 14px" }}>
                <span style={{ ...micro }}>
                  {/* A price the passenger set themselves replaces the calculated one. */}
                  {ride.offeredFareRwf != null
                    ? (t("motari.request.your_price") || "Your price.")
                       + (ride.fareMode === "QUOTED" ? ` · ${km(ride.quotedDistanceM)}` : "")
                    : ride.fareMode === "QUOTED"
                      ? `${t("motari.ride.fixed_fare") || "Fixed fare"} · ${km(ride.quotedDistanceM)}`
                      : `${t("motari.ride.metered") || "Meter"} · ${km(ride.riddenDistanceM)}`}
                </span>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 17, letterSpacing: "-0.01em" }}>
                  {ride.finalFareRwf != null ? fmt(ride.finalFareRwf)
                    : ride.offeredFareRwf != null ? fmt(ride.offeredFareRwf)
                    : ride.fareMode === "QUOTED" && ride.quotedFareRwf != null ? fmt(ride.quotedFareRwf)
                    : ride.status === "IN_RIDE" && meteredSoFar != null ? `≈ ${fmt(meteredSoFar)}`
                    : `${fmt(ride.perKmRwf)}/km`}
                </span>
              </div>

              {/* payment: once a motari accepted, pay now (platform prompt) or cash */}
              {ride.driver && ["ASSIGNED", "ARRIVED", "IN_RIDE", "COMPLETED"].includes(ride.status) && (() => {
                const amountKnown = (ride.finalFareRwf ?? ride.offeredFareRwf ?? ride.quotedFareRwf) != null;
                if (ride.paymentStatus === "PAID") {
                  return (
                    <div style={{ color: "#4ade80", fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                      ✓ {t("motari.ride.paid_platform") || "Paid via platform"}
                    </div>
                  );
                }
                if (ride.paymentMethod === "PLATFORM" && ride.paymentStatus === "PENDING") {
                  return (
                    <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                      {t("motari.ride.approve_prompt") || "Approve the payment prompt on your phone."}
                    </div>
                  );
                }
                if (payChoice === "cash") {
                  return (
                    <div style={{ ...micro, marginBottom: 12 }}>
                      {t("motari.ride.paying_cash") || "Paying cash."}{" "}
                      <button onClick={() => setPayChoice("")} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontFamily: "inherit", fontSize: 8.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", padding: 0 }}>
                        {t("motari.ride.change") || "Change"}
                      </button>
                    </div>
                  );
                }
                if (payOpen) {
                  return (
                    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                      <input
                        style={input}
                        value={payPhone}
                        onChange={e => setPayPhone(formatRwPhone(e.target.value))}
                        inputMode="numeric" maxLength={10}
                        placeholder="07xxxxxxxx"
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button disabled={paying || !isValidRwPhone(payPhone)} onClick={doPayNow} style={{ ...cta(!paying && isValidRwPhone(payPhone)), flex: 1.6 }}>
                          {paying ? (t("motari.ride.sending_prompt") || "Sending…") : (t("motari.ride.send_prompt") || "Send payment prompt")}
                        </button>
                        <button onClick={() => setPayOpen(false)} style={{ flex: 1, background: "none", border: "1px solid #1f1f1f", borderRadius: 10, color: "#888", fontWeight: 800, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" }}>
                          {t("common.buttons.cancel") || "Cancel"}
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={!amountKnown}
                        onClick={() => { setPayOpen(true); setPayPhone(formatRwPhone(ride.passengerPhone || phone || "")); }}
                        style={{ ...cta(amountKnown, "#16a34a"), color: amountKnown ? "#fff" : "#555", flex: 1 }}
                      >
                        {t("motari.ride.pay_now") || "Pay now"}
                      </button>
                      <button onClick={() => setPayChoice("cash")} style={{ flex: 1, background: "none", border: "1px solid #1f1f1f", borderRadius: 10, color: "#ccc", fontWeight: 800, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", padding: "10px 8px" }}>
                        {t("motari.ride.pay_cash") || "I'll pay cash"}
                      </button>
                    </div>
                    {!amountKnown && (
                      <div style={{ ...micro, marginTop: 6 }}>
                        {t("motari.ride.pay_after_meter") || "Open meter: pay when the ride completes."}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* actions per state */}
              {["SEARCHING", "ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <div style={{ display: "flex", gap: 8 }}>
                  {ride.status !== "IN_RIDE" && (
                    <button onClick={doCancel} disabled={busy} style={{
                      flex: 1, background: "transparent", color: "#f87171", borderRadius: 12,
                      padding: "11px 18px", fontWeight: 800, fontSize: 11.5, border: "1px solid #451a1a",
                      cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>
                      {t("motari.ride.cancel_ride") || "Cancel trip"}
                    </button>
                  )}
                  <a href="/contact" style={{
                    flex: 1, background: "#fff", color: "#000", borderRadius: 12,
                    padding: "11px 18px", fontWeight: 900, fontSize: 11.5, textDecoration: "none",
                    letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center",
                  }}>
                    {t("motari.ride.support") || "Support"}
                  </a>
                </div>
              )}

              {ride.status === "COMPLETED" && (
                <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid #7c3a10", borderRadius: 12, padding: 12, fontSize: 12, color: "#eee", lineHeight: 1.6, fontWeight: 500 }}>
                  {t("motari.ride.pay_hint") || "Hand over the fare, cash or MoMo. Your driver confirms, your record lands here."}
                </div>
              )}

              {ride.status === "CLOSED" && (
                !ride.rating ? (
                  <div>
                    <div style={{ ...micro, marginBottom: 7 }}>
                      {t("motari.ride.rate_prompt") || "Rate your motari. It keeps the good ones busy."}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => doRate(n)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                          <Star size={24} color="#fbbf24" fill={n <= stars ? "#fbbf24" : "none"} />
                        </button>
                      ))}
                    </div>
                    <button onClick={reset} style={cta(true)}>{t("motari.ride.new_ride") || "New ride"}</button>
                  </div>
                ) : (
                  <button onClick={reset} style={cta(true)}>{t("motari.ride.new_ride") || "New ride"}</button>
                )
              )}

              {["CANCELLED", "NO_MATCH"].includes(ride.status) && (
                <button onClick={reset} style={cta(true)}>{t("motari.ride.try_again") || "Ask again"}</button>
              )}

              {error && <div style={{ color: "#f87171", fontSize: 12.5, marginTop: 10 }}>{error}</div>}
            </>
          )}
        </div>
      </div>

      <MotariRegisterModal open={registerOpen} onClose={() => setRegisterOpen(false)}
        onSignIn={() => { setRegisterOpen(false); setLoginOpen(true); }} />
      <MotariLoginModal open={loginOpen} onClose={() => setLoginOpen(false)}
        onRegister={() => { setLoginOpen(false); setRegisterOpen(true); }} />
      </div>

      <style>{`
        @keyframes mspin { to { transform: rotate(360deg) } }
        @keyframes gpspulse { 0% { transform: scale(0.6); opacity: 0.9 } 100% { transform: scale(1.8); opacity: 0 } }
        /* Placeholders read as hints, never as typed text. */
        .motari-frame input::placeholder { color: #4a4a4a; font-weight: 400; opacity: 1; }
        /* Only on wide screens: outline the app frame so it reads as a device. */
        @media (min-width: 520px) {
          .motari-frame {
            border-left: 1px solid #1f1f1f;
            border-right: 1px solid #1f1f1f;
            box-shadow: 0 0 80px rgba(0,0,0,0.9);
          }
        }
      `}</style>
    </div>
  );
}
