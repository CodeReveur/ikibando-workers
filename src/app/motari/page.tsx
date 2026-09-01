"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MotariMap, type MapPoint } from "@/components/motari/MotariMap";
import { MotariRegisterModal } from "@/components/motari/MotariRegisterModal";
import { MotariLoginModal } from "@/components/motari/MotariLoginModal";
import { searchPlaces, reverseGeocode, type PlaceSuggestion } from "@/lib/geocoding";
import { getRoute, fmtDistance, fmtDuration, type RouteResult } from "@/lib/routing";
import {
  getRideQuote, requestRide, trackRide, cancelRide, rateRide, payRideNow,
  confirmDelivery, disputeDelivery,
  getMotariSupply, sendPassengerPosition, declareCash, apiError,
  type RideQuote, type RideDto, type RideKind, type MotariSupply,
} from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { AppTip } from "@/components/app/get-the-app";
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

  /**
   * The pickup as the location watch sees it.
   *
   * The watch is registered once and closes over whatever `pickup` was at the
   * time, which is always null. Auto-locating has to know whether a pickup has
   * appeared since, or it would write over one the passenger chose themselves.
   */
  const pickupRef = useRef<Picked | null>(null);
  useEffect(() => { pickupRef.current = pickup; }, [pickup]);
  const [dest, setDest] = useState<Picked | null>(null);
  const [pickupQ, setPickupQ] = useState("");
  const [destQ, setDestQ] = useState("");
  const [pickupSug, setPickupSug] = useState<PlaceSuggestion[]>([]);
  const [destSug, setDestSug] = useState<PlaceSuggestion[]>([]);
  const [searchingPickup, setSearchingPickup] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);

  /// Which field's list is showing. A list that cannot be closed is a trap, so
  /// exactly one is open at a time and anything outside it closes it.
  const [openList, setOpenList] = useState<null | "pickup" | "dest">(null);

  /**
   * The destination question has an answer: a place picked, text the map did
   * not know and the passenger kept, or "no destination, run the meter". Typing
   * half a word is not an answer, which is why this is not simply "is the box
   * empty".
   */
  const [destSettled, setDestSettled] = useState(false);

  /** True once the fare has been touched, after which a new quote leaves it alone. */
  const [fareTouched, setFareTouched] = useState(false);

  /** A folded line reopened to change, if any. */
  const [editing, setEditing] = useState<null | "from" | "to" | "fare">(null);

  /// Places this passenger has used before. Somewhere they have been is a
  /// better first guess than an empty box, and it costs no search to show.
  const [recent, setRecent] = useState<PlaceSuggestion[]>([]);
  const formRef = useRef<HTMLDivElement | null>(null);
  const [locating, setLocating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [offerFare, setOfferFare] = useState("");
  const [editingFare, setEditingFare] = useState(false);

  // Places come back from the device, so a returning passenger is offered
  // where they have been rather than a blank list.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("motari.recent.places");
      if (raw) setRecent((JSON.parse(raw) as PlaceSuggestion[]).slice(0, 6));
    } catch {
      // A device that will not remember is not a reason to fail.
    }
  }, []);

  const remember = useCallback((place: PlaceSuggestion) => {
    setRecent(prev => {
      const next = [place, ...prev.filter(p => p.label !== place.label)].slice(0, 6);
      try {
        localStorage.setItem("motari.recent.places", JSON.stringify(next));
      } catch {
        // Same: remembering is a courtesy, not a requirement.
      }
      return next;
    });
  }, []);

  // Anywhere outside the form closes whatever list is open, which is what
  // everyone already expects a dropdown to do. Escape closes it too.
  useEffect(() => {
    if (!openList) return;
    const outside = (e: PointerEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setOpenList(null);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenList(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [openList]);

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

  /**
   * "Could not read your location. Type your pickup instead."
   *
   * Kept apart from [error] because it is advice rather than a failure, and
   * because it has to disappear on its own: it told the passenger to type
   * their pickup, so it cannot still be on screen once they have. Clearing
   * [error] wholesale would have swallowed a real API error alongside it.
   */
  const [gpsAdvice, setGpsAdvice] = useState("");

  // live ride
  const [ride, setRide] = useState<RideDto | null>(null);
  const [stars, setStars] = useState(0);
  const tokenRef = useRef<string | null>(null);

  // Live device position: watched continuously, so the blue dot always shows
  // where the phone actually is and keeps refreshing as it moves.
  const [device, setDevice] = useState<MapPoint | null>(null);
  const [deviceAcc, setDeviceAcc] = useState<number | null>(null);
  const deviceRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * How tight a fix has to be before we will put a pickup pin on it.
   *
   * Twenty five metres, not two hundred. Two hundred was enough to name the
   * wrong street: Kigali's KK and KG districts meet along roads narrower than
   * that, so a fix inside its own stated accuracy could still reverse geocode
   * to the wrong side of a junction and tell a passenger standing on KK that
   * they were on KG. A phone outdoors reaches this in a few seconds.
   *
   * A coarser reading is still drawn, ringed by its accuracy circle so it is
   * visibly a guess. What it does not get is a name and a pin.
   */
  const TRUSTWORTHY_M = 25;

  /** Auto-locating is a courtesy, and a courtesy is offered once. */
  const autoLocated = useRef(false);

  /**
   * The tightest fix seen so far.
   *
   * Readings arrive worst first: the browser answers from the network while
   * the GPS is still warming up, and it can wander back and forth afterwards.
   * Taking the latest would mean a good position being replaced by a worse
   * one; taking the best means the dot settles rather than jitters.
   */
  const bestAccuracy = useRef(Infinity);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      p => {
        /*
         * Every reading is kept, however coarse.
         *
         * This used to drop anything worse than five kilometres as "an IP-level
         * guess, not a GPS fix", which is true and was the wrong thing to do
         * with it: a laptop on Wi-Fi reports tens of kilometres, so the dot
         * never appeared, the map never centred, and the whole thing looked
         * broken rather than approximate. The accuracy circle was already there
         * to say how much to trust it. Now it gets something to draw.
         */
        const accuracy = p.coords.accuracy ?? Infinity;

        // Keep the better of what we have and what just arrived, so a stray
        // coarse reading cannot throw away a good one. A fix that is no worse
        // than half as good still wins, because the phone does move.
        const better = accuracy <= bestAccuracy.current * 2 || !deviceRef.current;
        if (better) {
          bestAccuracy.current = Math.min(bestAccuracy.current, accuracy);
          deviceRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
          setDevice({ latitude: p.coords.latitude, longitude: p.coords.longitude });
          setDeviceAcc(p.coords.accuracy ?? null);
        }
        // The watch can succeed a second after the one-shot gave up. Once the
        // phone knows where it is, the advice is simply wrong.
        setGpsAdvice("");

        /*
         * Fill the pickup in, once, from the first fix worth standing on.
         *
         * Somebody opening this page wants a moto where they are; making them
         * tap "use my location" to say so is a step that only ever has one
         * answer. It is written into the field rather than held silently, so
         * they can read it and change it, and it never overwrites a pickup
         * they have already chosen.
         */
        if (
          !autoLocated.current &&
          accuracy <= TRUSTWORTHY_M &&
          !pickupRef.current &&
          !tokenRef.current
        ) {
          autoLocated.current = true;
          const { latitude, longitude } = p.coords;
          reverseGeocode(latitude, longitude)
            .then(loc => {
              // They may have typed something while the name was coming back.
              if (pickupRef.current) return;
              const label = loc.address.split(",").slice(0, 2).join(",").trim();
              setPickup({ latitude, longitude, label });
              setPickupQ(label);
            })
            .catch(() => { autoLocated.current = false; });
        }
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

  /* ── the passenger's phone reports in while riding ─────────────────────── */
  useEffect(() => {
    const live = ride && ["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status);
    if (!live || !tokenRef.current) return;
    const send = () => {
      const at = deviceRef.current;
      if (at) sendPassengerPosition(tokenRef.current!, at.lat, at.lng).catch(() => {});
    };
    send();
    const id = setInterval(send, 8000);
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
      setGpsAdvice("");
      const loc = await reverseGeocode(fix.lat, fix.lng);
      const label = loc.address.split(",").slice(0, 2).join(",").trim();
      setPickup({ latitude: fix.lat, longitude: fix.lng, label });
      setPickupQ(label);
      setLocating(false);
      return;
    }
    if (!navigator.geolocation) return;
    setLocating(true);
    setGpsAdvice("");
    navigator.geolocation.getCurrentPosition(
      async p => {
        const loc = await reverseGeocode(p.coords.latitude, p.coords.longitude);
        const label = loc.address.split(",").slice(0, 2).join(",").trim();
        setPickup({ latitude: p.coords.latitude, longitude: p.coords.longitude, label });
        setPickupQ(label);
        setLocating(false);
      },
      () => { setGpsAdvice(t("motari.request.gps_denied") || "Could not read your location. Type your pickup instead."); setLocating(false); },
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
  /** Words the passenger typed and kept, when no place on the map matched. */
  const typedDest = !dest && destQ.trim().length >= 2 ? destQ.trim() : null;
  /** Anywhere to go: a pin, or just a name. */
  const hasDestination = !!dest || !!typedDest;
  /** Only a pinned destination can be measured and priced from the road. */
  const measurable = !!dest;
  /** An unmeasurable trip is priced by the passenger, not by the meter. */
  const needsNamedPrice = !!typedDest;

  /** What no trip may be priced under. */
  const minFare = kind === "COURIER" ? courierMin : (quote?.minFareRwf ?? 500);

  /**
   * The sheet in stages. Nothing that could be filled in now is hidden: the
   * tabs and both places are always on screen, and what follows appears as the
   * part before it is answered.
   */
  const placesDone = !!pickup && destSettled && (kind !== "COURIER" || hasDestination);
  const fareDone = placesDone && priced >= minFare;
  const whoDone = name.trim().length >= 2 && isValidRwPhone(phone);
  /** Once the fare is agreed the places fold away to a line each. */
  const folded = fareDone;

  /**
   * A destination taken off the map has a route behind it, so the app can price
   * it and only asks the passenger to agree. One typed as free text has nothing
   * to measure, so the price is theirs to set.
   */
  const pricedByRoute = measurable && (quote?.quotedFareRwf ?? 0) > 0;

  // Where there is a route, the box opens with that price already in it: a
  // number to agree with reads faster than an empty box to work out.
  useEffect(() => {
    if (!fareTouched && pricedByRoute && quote?.quotedFareRwf) {
      setOfferFare(String(quote.quotedFareRwf));
    }
  }, [fareTouched, pricedByRoute, quote?.quotedFareRwf]);

  // A parcel must say where it is going, and clear the courier floor.
  const courierOk = kind !== "COURIER" || (hasDestination && priced >= courierMin);
  /** A trip nobody can measure needs a price before anyone can be sent for it. */
  const priceOk = !needsNamedPrice || priced >= (quote?.minFareRwf ?? 500);
  const canSubmit = !!pickup &&
      name.trim().length >= 2 &&
      isValidRwPhone(phone) &&
      priceOk &&
      courierOk &&
      !busy;

  const submit = async () => {
    if (!canSubmit || !pickup) return;
    setBusy(true);
    setError("");
    try {
      const r = await requestRide({
        name: name.trim(),
        phone: phone.trim(),
        pickupLat: pickup.latitude, pickupLng: pickup.longitude, pickupName: pickup.label,
        ...(dest
          ? { destLat: dest.latitude, destLng: dest.longitude, destName: dest.label }
          : typedDest
            ? { destName: typedDest }
            : {}),
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

  /// Agreeing the parcel arrived, or saying it never did. The second closes
  /// nothing: it stops the clock and hands the ride to support, because two
  /// people disagreeing about an object is not something a button settles.
  const doConfirmDelivery = async () => {
    if (!tokenRef.current || busy) return;
    setBusy(true);
    setError("");
    try {
      setRide(await confirmDelivery(tokenRef.current));
    } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const doDisputeDelivery = async () => {
    if (!tokenRef.current || busy) return;
    setBusy(true);
    setError("");
    try {
      setRide(await disputeDelivery(tokenRef.current));
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

  const sayPayingCash = async () => {
    if (!tokenRef.current || paying) return;
    setPaying(true);
    setError("");
    try {
      setRide(await declareCash(tokenRef.current));
      setPayChoice("cash");
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
  /// The bar across the top of any open list: what it is, and the way to shut
  /// it. Nothing the passenger opens should be something they cannot close.
  const listHead = (label: string) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 9px 7px 13px", borderBottom: "1px solid #1a1a1a",
    }}>
      <span style={{ ...micro, color: "#777" }}>{label}</span>
      <button
        onClick={() => setOpenList(null)}
        aria-label={t("common.buttons.close") || "Close"}
        style={{
          background: "none", border: "none", cursor: "pointer", color: "#888",
          display: "flex", alignItems: "center", padding: 4, borderRadius: 6,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );

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
        defaultBasemap="satellite"
        pickup={mapPickup}
        destination={mapDest}
        driver={mapDriver}
        self={device}
        selfAccuracyM={deviceAcc}
        route={!ride && route ? route.coordinates : null}
        onPick={ride ? undefined : pickOnMap}
        // Below the menu button, because the bottom of this page is a sheet.
        switchStyle={{ top: 56, right: 14, bottom: "auto" }}
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

      {/* The app, offered to the one person on the site who most wants it:
          someone asking for a moto in a browser. Only while nothing is under
          way, and only until they close it. */}
      {!ride && (
        <AppTip
          storageKey="motari.app_tip"
          style={{ position: "absolute", top: 104, left: 14, maxWidth: 250, zIndex: 998 }}
        />
      )}

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
            // Everything inside this counts as "in the form": a pointer landing
            // anywhere else closes whichever list is open.
            <div ref={formRef}>
              {/* Ride or parcel, with how much supply is actually around. */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                {([
                  ["RIDE", Bike, t("common.buttons.ask_motari") || "Ask Motari"],
                  ["COURIER", Package, t("motari.request.delivery") || "Delivery"],
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

              {/* Once the fare is agreed the three answers above fold to a line
                  each, so the part still being filled in is the part on screen.
                  Tapping one puts just that field back. */}
              {folded && (
                <div style={{ marginBottom: 12 }}>
                  {([
                    ["from", "#f97316", t("motari.request.from_label") || "From",
                      pickupQ || (t("motari.request.my_location") || "Where I am")],
                    ["to", "#16a34a", t("motari.request.to_label") || "To",
                      destQ.trim() || (t("motari.request.meter_ride") || "Meter ride")],
                    ["fare", "#f97316", t("motari.request.fare_label") || "Fare", fmt(priced)],
                  ] as const).map(([key, dot, label, value]) => (
                    <button
                      key={key}
                      onClick={() => setEditing(editing === key ? null : key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        background: "none", border: "none", padding: "0 0 10px",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                      <span style={{ ...micro, width: 42, flexShrink: 0 }}>{label}</span>
                      <span style={{
                        flex: 1, color: "#fff", fontSize: 12.5, fontWeight: 700,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{value}</span>
                      <span style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: "#0a0a0a", border: "1px solid #1f1f1f",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#f97316",
                      }}>
                        <Pencil size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* pickup */}
              <div style={{ position: "relative", marginBottom: 8,
                            display: !folded || editing === "from" ? undefined : "none" }}>
                <MapPin size={12} color="#f97316" style={iconLeft} />
                <input
                  style={input}
                  placeholder={t("motari.request.pickup_placeholder") || "From"}
                  onFocus={() => setOpenList("pickup")}
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
                {openList === "pickup" && (searchingPickup || pickupSug.length > 0
                  || (pickupQ.trim().length >= 2 && !pickup)
                  || (pickupQ.trim().length < 2 && recent.length > 0)) && (
                  <div style={suggestBox}>
                    {listHead(
                      searchingPickup
                        ? (t("motari.request.searching") || "Searching…")
                        : pickupSug.length > 0
                          ? (t("motari.request.matches") || "Places")
                          : pickupQ.trim().length < 2
                            ? (t("motari.request.recent") || "Recently used")
                            : (t("motari.request.no_match_head") || "Nothing matched")
                    )}
                    {pickupSug.length > 0 && pickupSug.map((sg, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setPickup({ latitude: sg.latitude, longitude: sg.longitude, label: sg.label });
                        setPickupQ(sg.label);
                        setPickupSug([]);
                        setOpenList(null);
                        remember(sg);
                      }}>
                        <b>{sg.label}</b>
                        <span style={{ display: "block", color: "#777", fontSize: 11.5, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sg.fullName}</span>
                      </button>
                    ))}
                    {pickupSug.length === 0 && pickupQ.trim().length < 2 && recent.map((sg, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setPickup({ latitude: sg.latitude, longitude: sg.longitude, label: sg.label });
                        setPickupQ(sg.label);
                        setOpenList(null);
                      }}>
                        <b>{sg.label}</b>
                      </button>
                    ))}
                    {!searchingPickup && pickupSug.length === 0 && pickupQ.trim().length >= 2 && (
                      <div style={{ padding: "10px 13px", fontSize: 11.5, color: "#888" }}>
                        {t("motari.request.no_match") || "No match. Tap the map to drop a pin."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* destination */}
              <div style={{ position: "relative", marginBottom: 10,
                            display: !folded || editing === "to" ? undefined : "none" }}>
                <Flag size={12} color={kind === "COURIER" && !dest ? "#f97316" : "#16a34a"} style={iconLeft} />
                <input
                  // A parcel's destination is required: the field says so until it is picked.
                  style={kind === "COURIER" && !hasDestination
                    ? { ...input, borderColor: "#7c3a10" }
                    : input}
                  placeholder={kind === "COURIER"
                    ? (t("motari.request.destination_required") || "To (required for parcels)")
                    : (t("motari.request.destination_placeholder") || "To (optional)")}
                  onFocus={() => setOpenList("dest")}
                  value={destQ}
                  onChange={e => {
                    setDestQ(e.target.value);
                    if (dest) setDest(null);
                    setDestSettled(false);
                    setOpenList("dest");
                  }}
                />
                {hasDestination && (
                  <button onClick={() => { setDest(null); setDestQ(""); setDestSettled(false); }} aria-label="Clear destination" style={{
                    position: "absolute", right: 6, top: 17, transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#666",
                  }}>
                    <X size={13} />
                  </button>
                )}
                {openList === "dest" && (searchingDest || destSug.length > 0 || typedDest
                  || (destQ.trim().length < 2 && recent.length > 0)) && (
                  <div style={suggestBox}>
                    {listHead(
                      searchingDest
                        ? (t("motari.request.searching") || "Searching…")
                        : destSug.length > 0
                          ? (t("motari.request.matches") || "Places")
                          : typedDest
                            ? (t("motari.request.no_match_head") || "Nothing matched")
                            : (t("motari.request.recent") || "Recently used")
                    )}
                    {destSug.length > 0 && destSug.map((sg, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setDest({ latitude: sg.latitude, longitude: sg.longitude, label: sg.label });
                        setDestQ(sg.label);
                        setDestSug([]);
                        setOpenList(null);
                        setDestSettled(true);
                        remember(sg);
                      }}>
                        <b>{sg.label}</b>
                        <span style={{ display: "block", color: "#777", fontSize: 11.5, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sg.fullName}</span>
                      </button>
                    ))}
                    {destSug.length === 0 && !typedDest && destQ.trim().length < 2 && recent.map((sg, i) => (
                      <button key={i} style={suggestItem} onClick={() => {
                        setDest({ latitude: sg.latitude, longitude: sg.longitude, label: sg.label });
                        setDestQ(sg.label);
                        setOpenList(null);
                        setDestSettled(true);
                      }}>
                        <b>{sg.label}</b>
                      </button>
                    ))}
                    {/* A place the map has never heard of is still a place. Saying
                        so is a choice the passenger makes and closes, not a notice
                        that sits over the form until they give up. */}
                    {!searchingDest && destSug.length === 0 && typedDest && (
                      <button
                        style={{ ...suggestItem, borderBottom: "none" }}
                        onClick={() => { setDestSettled(true); setOpenList(null); }}
                      >
                        <b style={{ color: "#fff" }}>
                          {t("motari.request.use_typed") || "We will send your motari here"}
                        </b>
                        <span style={{ display: "block", color: "#888", fontSize: 11.5, marginTop: 2 }}>
                          {t("motari.request.typed_hint")
                            || "Not on the map, so name what you will pay"}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* A ride with nowhere named runs on the meter. Saying so is an
                  answer to the question, not a refusal to answer it. */}
              {!folded && kind === "RIDE" && !destSettled && !destQ.trim() && (
                <button
                  onClick={() => { setDest(null); setDestSettled(true); }}
                  style={{
                    width: "100%", marginBottom: 10, background: "transparent",
                    border: "1px solid #1f1f1f", borderRadius: 10, padding: "9px 14px",
                    color: "#888", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
                    fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase",
                  }}
                >
                  {t("motari.request.no_destination_button") || "I will show the way. Use the meter"}
                </button>
              )}

              {/* trip chips: km · min · fare */}
              {/* How much. It arrives once there is somewhere to go, because
                  before that there is nothing to price. A destination taken off
                  the map has a route behind it, so the box opens with that price
                  and the passenger only has to agree; one typed as free text has
                  nothing to measure, so the price is theirs to name. */}
              {placesDone && (!folded || editing === "fare") && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={micro}>
                      {pricedByRoute
                        ? (t("motari.request.approx_amount") || "Approximate fare")
                        : (t("motari.request.name_price") || "What will you pay?")}
                    </span>
                    {pricedByRoute && route?.distanceM != null && (
                      <span style={{ ...micro, marginLeft: "auto", color: "#555" }}>
                        {km(route.distanceM)}
                      </span>
                    )}
                  </div>

                  {pricedByRoute ? (
                    <div style={{ color: "#888", fontSize: 11.5, lineHeight: 1.45, marginBottom: 8 }}>
                      {t("motari.request.approx_hint")
                        || "Worked out from the route. You can change it, but this is what motari expect."}
                    </div>
                  ) : quote && !measurable ? (
                    <div style={{ color: "#888", fontSize: 11.5, lineHeight: 1.45, marginBottom: 8 }}>
                      {t("motari.request.meter_card")
                        || `No destination, so the meter runs: ${fmt(quote.baseFareRwf)} to start, ${fmt(quote.perKmRwf)} per kilometre.`}
                    </div>
                  ) : null}

                  <div style={{ position: "relative" }}>
                    <span style={{
                      position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                      color: "#555", fontSize: 11, fontWeight: 800, pointerEvents: "none",
                    }}>RWF</span>
                    <input
                      style={{ ...input, paddingLeft: 46, fontSize: 17, fontWeight: 900, color: "#f97316" }}
                      value={offerFare}
                      onChange={e => { setFareTouched(true); setOfferFare(e.target.value.replace(/\D/g, "")); }}
                      inputMode="numeric"
                      maxLength={7}
                      placeholder={`${t("motari.request.at_least") || "At least"} ${fmt(minFare)}`}
                    />
                  </div>

                  {priced > 0 && priced < minFare && (
                    <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 6 }}>
                      {t("motari.request.too_little") || `Less than the ${fmt(minFare)} this trip starts at.`}
                    </div>
                  )}

                  {folded && editing === "fare" && (
                    <button
                      onClick={() => setEditing(null)}
                      style={{
                        width: "100%", marginTop: 8, background: "transparent",
                        border: "1px solid #1f1f1f", borderRadius: 10, padding: "8px 14px",
                        color: "#888", fontSize: 10.5, fontWeight: 800, cursor: "pointer",
                        fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase",
                      }}
                    >
                      {t("motari.request.done") || "Done"}
                    </button>
                  )}
                </div>
              )}

              {/* what is being sent (delivery only) */}
              {kind === "COURIER" && !folded && (
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

              {/* Who is asking, once the money is agreed. */}
              {fareDone && !editing && (
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
              )}

              {/* Advice, not a failure, and worded as one: amber rather than
                  red, and gone the moment the phone knows where it is or the
                  passenger does what it asked. */}
              {gpsAdvice && !pickup && (
                <div style={{ color: "#fbbf24", fontSize: 12, marginBottom: 10 }}>{gpsAdvice}</div>
              )}
              {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</div>}

              {/* The button arrives when there is something to press it for,
                  rather than sitting greyed out through the whole form. */}
              {fareDone && whoDone && !editing && (
                <button onClick={submit} disabled={!canSubmit} style={cta(canSubmit)}>
                  {busy
                    ? (t("motari.request.requesting") || "Requesting…")
                    : kind === "COURIER"
                      ? (t("motari.request.find_delivery") || "Find me a delivery motari")
                      : (t("motari.request.find") || "Find me a motari")}
                </button>
              )}

              <div style={{ ...micro, textAlign: "center", marginTop: 10, color: "#555" }}>
                {t("motari.request.trust") || "Verified drivers · Plates you can check · Cash or MoMo"}
              </div>
            </div>
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
                      {/* How other passengers have found this motari, in full. */}
                      {typeof ride.driver.rating === "number" && ride.driver.rating > 0 ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 800, color: "#fff", fontSize: 11.5 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} size={11} color="#fbbf24"
                              fill={n <= Math.round(ride.driver!.rating!) ? "#fbbf24" : "none"} />
                          ))}
                          <span style={{ marginLeft: 3 }}>{ride.driver.rating.toFixed(1)}</span>
                        </span>
                      ) : (
                        <span style={micro}>{t("motari.ride.new_motari") || "New motari"}</span>
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
                if (ride.cashDeclaredAt || payChoice === "cash") {
                  return (
                    <div style={{ ...micro, marginBottom: 12, color: "#4ade80" }}>
                      {t("motari.ride.cash_recorded") || "Cash payment recorded. Nothing else to do."}
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
                    {ride.payDue && (
                      <div style={{ ...micro, color: "#fbbf24", marginBottom: 6 }}>
                        {t("motari.ride.pay_due") || "Almost there. Settle the fare now."}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={!amountKnown}
                        onClick={() => { setPayOpen(true); setPayPhone(formatRwPhone(ride.passengerPhone || phone || "")); }}
                        style={{ ...cta(amountKnown, "#16a34a"), color: amountKnown ? "#fff" : "#555", flex: 1 }}
                      >
                        {t("motari.ride.pay_now") || "Pay now"}
                      </button>
                      <button disabled={paying} onClick={sayPayingCash} style={{ flex: 1, background: "none", border: "1px solid #1f1f1f", borderRadius: 10, color: "#ccc", fontWeight: 800, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", padding: "10px 8px" }}>
                        {t("motari.ride.pay_cash") || "I paid cash"}
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

              {/* A parcel the motari is carrying: what is left to do with it. */}
              {ride.kind === "COURIER" && ride.deliveredAt && !ride.deliveryConfirmedAt && !ride.deliveryDisputedAt && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
                    {t("motari.parcel.motari_says_delivered") || "Your motari says the parcel is delivered."}
                  </div>
                  <div style={{ ...micro, marginTop: 3 }}>
                    {t("motari.parcel.stands_soon") || "IF YOU SAY NOTHING THIS STANDS SHORTLY"}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {ride.paymentStatus !== "PAID" && !ride.cashDeclaredAt && (
                      <button onClick={doPayNow} disabled={paying} style={{ ...cta(!paying), flex: 1 }}>
                        {t("motari.parcel.pay_now") || "Pay now"}
                      </button>
                    )}
                    <button onClick={doConfirmDelivery} disabled={busy} style={{ ...cta(!busy, "#16a34a"), color: busy ? "#555" : "#fff", flex: 1 }}>
                      {t("motari.parcel.confirm") || "Confirm delivery"}
                    </button>
                  </div>
                  <button onClick={doDisputeDelivery} disabled={busy} style={{
                    width: "100%", marginTop: 8, background: "transparent", color: "#f87171",
                    borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 10.5,
                    border: "1px solid #451a1a", cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>
                    {t("motari.parcel.not_delivered") || "It never arrived"}
                  </button>
                </div>
              )}

              {ride.kind === "COURIER" && ride.deliveryDisputedAt && (
                <div style={{ marginBottom: 12, color: "#f87171", fontSize: 12, lineHeight: 1.45 }}>
                  {t("motari.parcel.you_disputed") || "You said this parcel never arrived."}
                  <div style={{ ...micro, marginTop: 3 }}>
                    {t("motari.parcel.support_will_call") || "SUPPORT WILL BE IN TOUCH"}
                  </div>
                </div>
              )}

              {ride.kind === "COURIER" && ride.pickedUpAt && !ride.deliveredAt && (
                <div style={{ ...micro, marginBottom: 12, color: "#888", lineHeight: 1.5 }}>
                  {t("motari.parcel.cannot_cancel")
                    || "Your motari has the parcel, so this cannot be cancelled here. Call them to arrange it."}
                </div>
              )}

              {/* actions per state */}
              {["SEARCHING", "ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Once a motari has the parcel it is in someone else's hands,
                      so there is nothing here to cancel. */}
                  {ride.status !== "IN_RIDE" && !(ride.kind === "COURIER" && ride.pickedUpAt) && (
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
