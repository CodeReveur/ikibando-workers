"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, X, ChevronDown, ChevronUp } from "lucide-react";
import { shareJobLocation, stopJobLocation, getJobLocations, type LiveWorkerLocation } from "@/lib/api";

/**
 * App-wide live navigation overlay.
 *
 * Worker: while navigating to a job, the device streams GPS fixes to the server
 * and this floating card stays on EVERY page (home included) showing the
 * destination and remaining distance, with one tap back to the full map.
 *
 * Employer: while tracking, the card polls the worker's live position and shows
 * who is coming, how far they still are and when the fix was last updated.
 *
 * The session survives reloads via localStorage; pages start/stop it with
 * startWorkerNav / startEmployerTracking / stopLiveNav, which fire a window
 * event the overlay listens to.
 */

export interface LiveNavSession {
  jobId: string;
  role: "worker" | "employer";
  /** Destination label (worker) or job title (employer). */
  label: string;
  destLat?: number;
  destLng?: number;
  startedAt: number;
  /**
   * Worker only: whether the employer may follow this trip. OFF by default —
   * navigating for yourself must never broadcast your position without consent.
   * The worker turns it on (and can turn it off) from the overlay or the job page.
   */
  share?: boolean;
}

const KEY = "live_nav_session";
const EVT = "livenav:changed";

export function getLiveNavSession(): LiveNavSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LiveNavSession) : null;
  } catch { return null; }
}

function setSession(s: LiveNavSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function startWorkerNav(
  jobId: string, label: string, destLat?: number, destLng?: number, share = false,
) {
  const prev = getLiveNavSession();
  // Keep an existing consent if the worker re-opens the map mid-trip.
  const keep = prev && prev.jobId === jobId && prev.role === "worker" ? !!prev.share : false;
  setSession({ jobId, role: "worker", label, destLat, destLng, startedAt: Date.now(), share: share || keep });
}

/** Worker turns employer tracking on/off. Turning it off clears the server row. */
export function setLiveNavShare(share: boolean) {
  const s = getLiveNavSession();
  if (!s || s.role !== "worker") return;
  if (!share) {
    const token = localStorage.getItem("access_token") || "";
    if (token) stopJobLocation(s.jobId, token).catch(() => {});
  }
  setSession({ ...s, share });
}

export function startEmployerTracking(jobId: string, label: string, destLat?: number, destLng?: number) {
  setSession({ jobId, role: "employer", label, destLat, destLng, startedAt: Date.now() });
}

export function stopLiveNav() {
  const s = getLiveNavSession();
  if (s?.role === "worker") {
    const token = localStorage.getItem("access_token") || "";
    if (token) stopJobLocation(s.jobId, token).catch(() => {});
  }
  setSession(null);
}

const R = 6371000;
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function fmtDist(m: number | null): string {
  if (m == null) return "…";
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function LiveNavOverlay() {
  const [session, setSess] = useState<LiveNavSession | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [workerFix, setWorkerFix] = useState<LiveWorkerLocation | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  // Pick up the stored session on mount + whenever a page starts/stops one.
  useEffect(() => {
    const sync = () => setSess(getLiveNavSession());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);

  // Worker: stream GPS fixes (throttled to ~8s) and keep the remaining distance fresh.
  useEffect(() => {
    if (!session || session.role !== "worker") return;
    if (!("geolocation" in navigator)) { setGpsError(true); return; }
    const token = localStorage.getItem("access_token") || "";
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(false);
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        if (session.destLat != null && session.destLng != null) {
          setDistance(distanceM(latitude, longitude, session.destLat, session.destLng));
        }
        const now = Date.now();
        // Only ever transmit when the worker has explicitly agreed to be followed.
        if (session.share && token && now - lastSentRef.current > 8000) {
          lastSentRef.current = now;
          shareJobLocation(session.jobId, {
            latitude, longitude,
            accuracy: accuracy ?? undefined,
            heading: heading ?? undefined,
            speed: speed ?? undefined,
          }, token).catch(() => {});
        }
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [session?.jobId, session?.role, session?.share]); // eslint-disable-line react-hooks/exhaustive-deps

  // Employer: poll the worker's live position every 10s.
  useEffect(() => {
    if (!session || session.role !== "employer") return;
    const token = localStorage.getItem("access_token") || "";
    if (!token) return;
    let stopped = false;
    const poll = async () => {
      try {
        const fixes = await getJobLocations(session.jobId, token);
        if (stopped) return;
        const fix = fixes[0] ?? null;
        setWorkerFix(fix);
        if (fix && session.destLat != null && session.destLng != null) {
          setDistance(distanceM(fix.latitude, fix.longitude, session.destLat, session.destLng));
        }
      } catch { /* keep last known */ }
    };
    poll();
    const iv = setInterval(poll, 10000);
    return () => { stopped = true; clearInterval(iv); };
  }, [session?.jobId, session?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;

  const isWorker = session.role === "worker";
  const mapsHref = isWorker
    ? `/seeker/jobs/${session.jobId}/navigate`
    : workerFix
      ? `https://www.google.com/maps?q=${workerFix.latitude},${workerFix.longitude}`
      : undefined;
  const agoSec = workerFix ? Math.max(0, Math.round((Date.now() - new Date(workerFix.updatedAt).getTime()) / 1000)) : null;

  return (
    <div style={{
      position: "fixed", right: 14, bottom: 14, zIndex: 900,
      width: minimized ? "auto" : 290, maxWidth: "calc(100vw - 28px)",
      background: "#161616", border: "1px solid #2c2c2c", borderRadius: 16,
      boxShadow: "0 8px 28px rgba(0,0,0,.5)", overflow: "hidden",
      fontFamily: "Inter, DM Sans, system-ui, sans-serif", color: "#f0f0f0",
    }}>
      {/* Header row: pulsing dot + title + minimize / stop */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <span style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: "#22c55e", animation: "lnPulse 1.6s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 2, borderRadius: 999, background: "#22c55e" }} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {isWorker ? (session.share ? "Navigating · shared" : "Navigating") : "Tracking worker"}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setMinimized(m => !m)} aria-label="Minimize"
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 2, display: "flex" }}>
          {minimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button onClick={stopLiveNav} aria-label="Stop"
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={15} />
        </button>
      </div>

      {!minimized && (
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 8 }}>
            <MapPin size={13} color="#f97316" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 12, color: "#bbb", lineHeight: 1.4, overflowWrap: "anywhere" }}>
              {isWorker
                ? session.label
                : (workerFix
                    ? `${workerFix.name} is on the way`
                    : `Waiting for ${session.label} to share their location…`)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#f97316" }}>{fmtDist(distance)}</span>
            <span style={{ fontSize: 10.5, color: "#666" }}>
              {isWorker
                ? (gpsError ? "GPS unavailable, check location permission" : "to destination")
                : (workerFix ? `away · updated ${agoSec}s ago` : "no live fix yet")}
            </span>
          </div>

          {/* Worker consent: the employer can only follow this trip when this is ON. */}
          {isWorker && (
            <button
              onClick={() => setLiveNavShare(!session.share)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                background: session.share ? "rgba(34,197,94,0.1)" : "transparent",
                border: `1px solid ${session.share ? "rgba(34,197,94,0.4)" : "#333"}`,
                borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{
                width: 30, height: 17, borderRadius: 999, flexShrink: 0, position: "relative",
                background: session.share ? "#22c55e" : "#3a3a3a", transition: "background .15s",
              }}>
                <span style={{
                  position: "absolute", top: 2, left: session.share ? 15 : 2,
                  width: 13, height: 13, borderRadius: 999, background: "#fff", transition: "left .15s",
                }} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: session.share ? "#22c55e" : "#bbb" }}>
                  {session.share ? "Employer can see you" : "Let employer track me"}
                </span>
                <span style={{ display: "block", fontSize: 10, color: "#666", marginTop: 1 }}>
                  {session.share ? "Sharing your live position on the way" : "Off — your location stays private"}
                </span>
              </span>
            </button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {mapsHref && (
              <a href={mapsHref} target={isWorker ? undefined : "_blank"}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: "#f97316", color: "#fff", borderRadius: 10, padding: "8px 10px",
                  fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}>
                <Navigation size={13} /> {isWorker ? "Open map" : "View on map"}
              </a>
            )}
            <button onClick={stopLiveNav}
              style={{
                background: "transparent", border: "1px solid #333", color: "#999",
                borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>
              Stop
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes lnPulse{0%{transform:scale(1);opacity:.9}80%{transform:scale(2.4);opacity:0}100%{opacity:0}}`}</style>
    </div>
  );
}
