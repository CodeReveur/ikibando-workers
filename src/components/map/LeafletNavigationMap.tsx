"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation2, Volume2, VolumeX, LocateFixed, Loader2,
  CornerUpLeft, CornerUpRight, ArrowUp, MapPin, Flag,
  ChevronUp, ChevronDown, RotateCcw, Repeat2,
} from "lucide-react";
import {
  getRoute, haversineM, fmtDistance, fmtDuration,
  type LatLng, type RouteResult, type RouteStep,
} from "@/lib/routing";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface NavigationDestination {
  latitude: number;
  longitude: number;
  label?: string;
}

interface Props {
  destination: NavigationDestination;
}

const KIGALI: [number, number] = [-1.9441, 30.0619];

// Live-location marker: a pulsing blue dot (distinct from the red destination pin).
const liveIcon = L.divIcon({
  className: "nav-live-icon",
  html: `<div class="nav-live-dot"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const destIcon = L.divIcon({
  className: "nav-dest-icon",
  html: `<div class="nav-dest-pin"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/** Keeps the map following the traveller while "follow" is on. */
function Follow({ pos, follow }: { pos: [number, number] | null; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && pos) map.setView(pos, Math.max(map.getZoom(), 16), { animate: true });
  }, [pos, follow, map]);
  return null;
}

function StepIcon({ step, size = 16 }: { step: RouteStep; size?: number }) {
  const mod = (step.modifier || "").toLowerCase();
  if (step.type === "arrive") return <Flag size={size} color="#22c55e" />;
  if (step.type === "depart") return <MapPin size={size} color="#f97316" />;
  if (mod.includes("left"))  return <CornerUpLeft size={size} color="#60a5fa" />;
  if (mod.includes("right")) return <CornerUpRight size={size} color="#60a5fa" />;
  return <ArrowUp size={size} color="#888" />;
}

export default function LeafletNavigationMap({ destination }: Props) {
  const dest: LatLng = { latitude: destination.latitude, longitude: destination.longitude };

  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [voice, setVoice] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  // Overlays collapse so the map is never buried. Steps list starts collapsed.
  const [stepsOpen, setStepsOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [locating, setLocating] = useState(false);

  const watchId = useRef<number | null>(null);
  const lastRoutedFrom = useRef<LatLng | null>(null);
  const announcedStep = useRef<number>(-1);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // ── Fresh GPS acquisition ────────────────────────────────────────────────
  // maximumAge:0 forces a brand-new fix from the device sensor rather than a
  // browser-cached position, so the worker's location is always real-time.
  const startWatch = () => {
    if (!("geolocation" in navigator)) { setGpsError("Location is not supported on this device."); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setGpsError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setAccuracy(p.coords.accuracy);
        setPos([p.coords.latitude, p.coords.longitude]);
      },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED
        ? "Location permission denied. Enable it to track your route."
        : "Couldn't get your location. Make sure GPS is on."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  // Hard reset: drop any known position/route and re-acquire a genuinely fresh
  // fix. A one-shot getCurrentPosition (maximumAge:0) gives instant feedback that
  // it's re-locating, then the live watch takes over — no stale/cached position.
  const resetGps = () => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    setPos(null); setAccuracy(null); setRoute(null); setStepIdx(0);
    lastRoutedFrom.current = null; announcedStep.current = -1;
    setFollow(true);
    setGpsError(null);
    if ("geolocation" in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setAccuracy(p.coords.accuracy); setPos([p.coords.latitude, p.coords.longitude]); setLocating(false); },
        () => setLocating(false),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    }
    startWatch();
  };

  /** Speak an instruction now (also primes speech on mobile, which needs a tap). */
  const speak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch { /* ignore */ }
  };

  const toggleVoice = () => {
    setVoice((v) => {
      const next = !v;
      const cur = route?.steps[stepIdx];
      // Turning voice ON is a user gesture — speak the current maneuver so mobile
      // browsers unlock speech and the user immediately hears guidance.
      if (next && cur) speak(cur.voice || cur.instruction);
      else if (!next && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      return next;
    });
  };

  useEffect(() => {
    startWatch();
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── (Re)route when we first get a fix, or drift >40 m from the routed origin ──
  useEffect(() => {
    if (!pos) return;
    const from: LatLng = { latitude: pos[0], longitude: pos[1] };
    const drifted = !lastRoutedFrom.current || haversineM(lastRoutedFrom.current, from) > 40;
    if (!drifted || routing) return;
    lastRoutedFrom.current = from;
    setRouting(true);
    getRoute(from, dest)
      .then((r) => { if (r) setRoute(r); })
      .finally(() => setRouting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // ── Track the current step + speak the upcoming maneuver ─────────────────
  useEffect(() => {
    if (!pos || !route || route.steps.length === 0) return;
    const cur: LatLng = { latitude: pos[0], longitude: pos[1] };

    // The upcoming maneuver is the nearest step ahead of us.
    let bestIdx = 0, bestDist = Infinity;
    route.steps.forEach((s, i) => {
      const d = haversineM(cur, s.location);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    setStepIdx(bestIdx);

    // Announce once when within 60 m of the maneuver (or immediately for the first step).
    const step = route.steps[bestIdx];
    const near = bestDist < 60 || bestIdx === 0;
    if (voiceRef.current && near && announcedStep.current !== bestIdx && typeof window !== "undefined" && "speechSynthesis" in window) {
      announcedStep.current = bestIdx;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(step.voice));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, route]);

  useEffect(() => {
    // Silence any queued speech when voice is switched off.
    if (!voice && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [voice]);

  const straightLine = haversineM(
    pos ? { latitude: pos[0], longitude: pos[1] } : dest, dest
  );
  const upcoming = route?.steps[stepIdx];
  const center: [number, number] = pos ?? [dest.latitude, dest.longitude];

  const polyline = useMemo<[number, number][]>(() => route?.coordinates ?? [], [route]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 420 }}>
      <style>{CSS}</style>

      {/* Next-maneuver banner — collapsible to a thin bar so it never buries the map */}
      <div className={`nav-banner ${bannerOpen ? "" : "mini"}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <div className="nav-banner-icon">
            {upcoming ? <StepIcon step={upcoming} size={bannerOpen ? 20 : 16} /> : <Navigation2 size={16} color="#f97316" />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="nav-banner-instr">
              {routing && !route ? "Finding the best route…"
                : upcoming ? upcoming.instruction
                : "Head toward your destination"}
            </p>
            {bannerOpen && (
              <p className="nav-banner-sub">
                {route
                  ? <><strong style={{ color: "#f97316" }}>{fmtDuration(route.durationS)}</strong> · {fmtDistance(route.distanceM)} {destination.label ? `· ${destination.label}` : ""}</>
                  : <>~{fmtDistance(straightLine)} away {destination.label ? `· ${destination.label}` : ""}</>}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {upcoming && (
            <button className="nav-mini-btn" title="Read this step aloud"
              onClick={() => { if (!voice) setVoice(true); speak(upcoming.voice || upcoming.instruction); }}>
              <Repeat2 size={15} color="#22c55e" />
            </button>
          )}
          <button className="nav-mini-btn" title={bannerOpen ? "Minimize" : "Expand"} onClick={() => setBannerOpen(o => !o)}>
            {bannerOpen ? <ChevronUp size={15} color="#aaa" /> : <ChevronDown size={15} color="#aaa" />}
          </button>
        </div>
      </div>

      {/* Map */}
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: "100%", minHeight: 420, borderRadius: 14 }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polyline.length > 1 && (
          <>
            <Polyline positions={polyline} pathOptions={{ color: "#0a0a0a", weight: 9, opacity: 0.35 }} />
            <Polyline positions={polyline} pathOptions={{ color: "#f97316", weight: 5, opacity: 0.95 }} />
          </>
        )}
        {pos && <Marker position={pos} icon={liveIcon} />}
        <Marker position={[dest.latitude, dest.longitude]} icon={destIcon} />
        <Follow pos={pos} follow={follow} />
      </MapContainer>

      {/* Controls */}
      <div className="nav-controls" style={{ bottom: stepsOpen ? 268 : 60 }}>
        <button className="nav-btn" title={follow ? "Following you" : "Recenter on me"} onClick={() => { setFollow(true); }}>
          <LocateFixed size={18} color={follow ? "#f97316" : "#ccc"} />
        </button>
        <button className="nav-btn" title={voice ? "Voice on — tap to mute" : "Voice off — tap to hear directions"} onClick={toggleVoice}>
          {voice ? <Volume2 size={18} color="#22c55e" /> : <VolumeX size={18} color="#888" />}
        </button>
        <button className="nav-btn" title="Reset my location (fresh GPS, no cache)" onClick={resetGps}>
          <RotateCcw size={18} color={locating ? "#f59e0b" : "#60a5fa"} className={locating ? "nav-spin" : ""} />
        </button>
      </div>

      {/* GPS status pill */}
      <div className="nav-status" style={{ bottom: stepsOpen ? 272 : 64 }}>
        {gpsError
          ? <span style={{ color: "#ef4444" }}>{gpsError}</span>
          : pos
            ? <span style={{ color: "#22c55e" }}><LocateFixed size={11} /> Live GPS{accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}</span>
            : <span style={{ color: "#f59e0b" }}><Loader2 size={11} className="nav-spin" /> Acquiring your location…</span>}
      </div>

      {/* Turn-by-turn steps — collapsed by default (tap the header to open),
          so the route list never covers the map unless you ask for it. */}
      {route && route.steps.length > 0 && (
        <div className={`nav-steps ${stepsOpen ? "open" : ""}`}>
          <button className="nav-steps-head" onClick={() => setStepsOpen(o => !o)}>
            <span className="nav-steps-title">
              {stepsOpen ? "Route" : `Step ${stepIdx + 1} of ${route.steps.length}`} · {route.steps.length} steps
            </span>
            {stepsOpen ? <ChevronDown size={16} color="#888" /> : <ChevronUp size={16} color="#888" />}
          </button>
          {stepsOpen && (
            <div className="nav-steps-list">
              {route.steps.map((s, i) => (
                <div key={i} className={`nav-step ${i === stepIdx ? "active" : ""}`}>
                  <span className="nav-step-ic"><StepIcon step={s} /></span>
                  <span className="nav-step-instr">{s.instruction}</span>
                  {s.distanceM > 0 && <span className="nav-step-dist">{fmtDistance(s.distanceM)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
  .nav-live-dot { width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid #fff;
    box-shadow: 0 0 0 4px rgba(37,99,235,0.35); animation: navpulse 1.6s ease-out infinite; }
  @keyframes navpulse { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.5); } 70% { box-shadow: 0 0 0 14px rgba(37,99,235,0); } 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } }
  .nav-dest-pin { width: 22px; height: 22px; border-radius: 50% 50% 50% 0; background: #ef4444; border: 2px solid #fff;
    transform: rotate(-45deg); box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
  .nav-banner { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000; display: flex; align-items: center; gap: 8px;
    background: rgba(17,17,17,0.92); border: 1px solid #2a2a2a; border-radius: 12px; padding: 10px 12px; backdrop-filter: blur(6px); transition: padding 0.15s; }
  .nav-banner.mini { padding: 6px 10px; }
  .nav-banner.mini .nav-banner-icon { width: 28px; height: 28px; border-radius: 8px; }
  .nav-banner-icon { width: 38px; height: 38px; border-radius: 10px; background: rgba(249,115,22,0.1);
    border: 1px solid rgba(249,115,22,0.25); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .nav-banner-instr { margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-banner.mini .nav-banner-instr { margin: 0; font-size: 12.5px; }
  .nav-banner-sub { margin: 0; font-size: 12px; color: #999; }
  .nav-mini-btn { width: 30px; height: 30px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid #2f2f2f;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .nav-mini-btn:hover { border-color: #444; }
  .nav-controls { position: absolute; right: 12px; bottom: 96px; z-index: 1000; display: flex; flex-direction: column; gap: 8px; }
  .nav-btn { width: 42px; height: 42px; border-radius: 10px; background: rgba(17,17,17,0.94); border: 1px solid #2a2a2a;
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .nav-btn:hover { border-color: #3a3a3a; }
  .nav-status { position: absolute; left: 12px; bottom: 100px; z-index: 1000; font-size: 11px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 5px; background: rgba(17,17,17,0.94); border: 1px solid #2a2a2a; border-radius: 99px; padding: 5px 11px; }
  .nav-spin { animation: navspin 1s linear infinite; }
  @keyframes navspin { to { transform: rotate(360deg); } }
  .nav-steps { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 1000; overflow: hidden;
    background: rgba(17,17,17,0.96); border: 1px solid #2a2a2a; border-radius: 12px; backdrop-filter: blur(6px); }
  .nav-steps-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
    background: none; border: none; cursor: pointer; padding: 10px 12px; }
  .nav-steps-title { margin: 0; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .nav-steps-list { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; padding: 0 10px 10px; }
  .nav-step { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; }
  .nav-step.active { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.2); }
  .nav-step-ic { flex-shrink: 0; display: flex; }
  .nav-step-instr { flex: 1; font-size: 12px; color: #d0d0d0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-step-dist { flex-shrink: 0; font-size: 11px; color: #666; font-weight: 600; }
`;
