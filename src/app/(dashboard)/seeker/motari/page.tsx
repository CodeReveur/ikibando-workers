"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getMotariState, saveMotariProfile, setMotariOnline, motariHeartbeat,
  acceptRide, motariArrived, motariStart, motariComplete, motariPaid, motariCancelRide,
  apiError, type MotariState, type RideDto,
} from "@/lib/api";
import { NavigationMap } from "@/components/map/NavigationMap";
import { Bike, MapPin, Phone, Power, CheckCircle2, Banknote, Smartphone, X } from "lucide-react";

const POLL_MS = 5000;
const HEARTBEAT_MS = 4000;

const fmt = (n: number) => `RWF ${n.toLocaleString()}`;
const km = (m?: number) => `${((m ?? 0) / 1000).toFixed(1)} km`;

/**
 * The motari (driver) surface: register the moto, go online, see nearby ride
 * requests, claim one (first accept wins), then run the ride lifecycle —
 * arrived → start → complete → paid. While online the browser's GPS heartbeats
 * feed dispatch, live passenger tracking, and the metered fare.
 */
export default function MotariDriverPage() {
  const [state, setState] = useState<MotariState | null>(null);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState("");
  const [license, setLicense] = useState("");
  const [brand, setBrand] = useState("");
  const [legalName, setLegalName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const posRef = useRef<{ lat: number; lng: number } | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";

  const refresh = useCallback(async () => {
    try {
      setState(await getMotariState(token()));
      setError("");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // While online, watch the GPS and heartbeat it to the platform. The heartbeat
  // is what makes this driver visible to dispatch and advances a metered fare.
  const online = !!state?.profile?.online;
  useEffect(() => {
    if (!online || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      p => { posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }; setGpsError(""); },
      () => setGpsError("GPS unavailable — enable location to receive rides."),
      { enableHighAccuracy: true, maximumAge: 3000 },
    );
    const beat = setInterval(() => {
      const pos = posRef.current;
      if (pos) motariHeartbeat(pos.lat, pos.lng, token()).then(setState).catch(() => {});
    }, HEARTBEAT_MS);
    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(beat); };
  }, [online]);

  const act = async (fn: () => Promise<MotariState>) => {
    setBusy(true);
    setError("");
    try { setState(await fn()); } catch (e) { setError(apiError(e)); }
    setBusy(false);
  };

  const box: React.CSSProperties = {
    background: "#1c1c1c", border: "1px solid #272727", borderRadius: 14, padding: 16,
  };
  const input: React.CSSProperties = {
    width: "100%", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
    padding: "11px 12px", color: "#eee", fontSize: 14, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const primaryBtn = (enabled: boolean): React.CSSProperties => ({
    width: "100%", background: enabled ? "#f97316" : "#3a2a1c",
    color: enabled ? "#fff" : "#8a6a4a", borderRadius: 999, padding: "13px 24px",
    fontWeight: 800, fontSize: 14, border: "none",
    cursor: enabled ? "pointer" : "not-allowed", fontFamily: "inherit",
  });

  if (loading) {
    return <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
    </div>;
  }

  const ride: RideDto | undefined = state?.activeRide;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "8px 4px 40px", color: "#eee" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Bike size={24} color="#f97316" />
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Motari</h1>
      </div>
      <p style={{ color: "#777", fontSize: 13, margin: "0 0 18px" }}>
        Carry passengers on demand. Go online, accept a nearby request, ride, get paid.
      </p>

      {/* No profile yet → register the moto */}
      {!state?.profile ? (
        <div style={box}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>Register your moto</h2>
          <p style={{ color: "#888", fontSize: 13, margin: "0 0 14px", lineHeight: 1.6 }}>
            One-time setup. Your plate is shown to passengers so they can identify you at pickup.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <input style={input} placeholder="Legal name (as on your ID)" value={legalName}
                   onChange={e => setLegalName(e.target.value)} maxLength={120} />
            <input style={input} placeholder="Plate number (e.g. RC 123 A)" value={plate}
                   onChange={e => setPlate(e.target.value)} maxLength={20} />
            <input style={input} placeholder="Moto brand or model (e.g. TVS, Bajaj Boxer)" value={brand}
                   onChange={e => setBrand(e.target.value)} maxLength={60} />
            <input style={input} placeholder="Driving permit number (optional)" value={license}
                   onChange={e => setLicense(e.target.value)} maxLength={40} />
            <button
              disabled={busy || plate.trim().length < 4}
              onClick={() => act(() => saveMotariProfile({
                plateNumber: plate,
                licenseNumber: license || undefined,
                brandModel: brand || undefined,
                legalName: legalName || undefined,
              }, token()))}
              style={primaryBtn(!busy && plate.trim().length >= 4)}
            >
              Save profile
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Presence */}
          <div style={{ ...box, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {state.profile.brandModel ? `${state.profile.brandModel} · ` : ""}{state.profile.plateNumber}
                <span style={{
                  marginLeft: 10, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 10px",
                  background: online ? "rgba(34,197,94,0.12)" : "#141414",
                  color: online ? "#22c55e" : "#666",
                  border: online ? "1px solid #14532d" : "1px solid #2a2a2a",
                }}>
                  {online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#777", marginTop: 3 }}>
                {state.profile.totalRides} rides completed
                {gpsError && <span style={{ color: "#f87171" }}> · {gpsError}</span>}
              </div>
            </div>
            <button
              disabled={busy || !!ride}
              onClick={() => act(() => setMotariOnline(!online, token()))}
              title={ride ? "Finish your current ride first" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999,
                padding: "10px 20px", fontWeight: 800, fontSize: 13, cursor: ride ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                background: online ? "transparent" : "#f97316",
                color: online ? "#f87171" : "#fff",
                border: online ? "1px solid #7f1d1d" : "none",
                opacity: ride ? 0.5 : 1,
              }}
            >
              <Power size={14} /> {online ? "Go offline" : "Go online"}
            </button>
          </div>

          {/* Active ride */}
          {ride ? (
            <div style={{ ...box, marginBottom: 14, borderColor: "#f97316" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                  {ride.status === "ASSIGNED" && "Head to the pickup"}
                  {ride.status === "ARRIVED" && "Waiting for your passenger"}
                  {ride.status === "IN_RIDE" && "Ride in progress"}
                  {ride.status === "COMPLETED" && "Collect the fare"}
                </h2>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f97316" }}>{ride.fareMode}</span>
              </div>

              <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.9, marginBottom: 12 }}>
                <div><b style={{ color: "#eee" }}>{ride.passengerName}</b>
                  {ride.passengerPhone && (
                    <a href={`tel:${ride.passengerPhone}`} style={{ marginLeft: 10, color: "#f97316", textDecoration: "none", fontWeight: 700 }}>
                      <Phone size={12} style={{ display: "inline", verticalAlign: "-1px" }} /> {ride.passengerPhone}
                    </a>
                  )}
                </div>
                <div><MapPin size={12} color="#f97316" style={{ display: "inline", verticalAlign: "-1px" }} /> {ride.pickupName || "Pickup pin on the map"}</div>
                <div style={{ color: "#888" }}>
                  → {ride.destName || "Open destination — passenger will direct you (metered)"}
                </div>
                <div style={{ color: "#f97316", fontWeight: 800 }}>
                  {ride.finalFareRwf != null
                    ? `Fare: ${fmt(ride.finalFareRwf)}`
                    : ride.fareMode === "QUOTED" && ride.quotedFareRwf != null
                      ? `Fixed fare: ${fmt(ride.quotedFareRwf)}`
                      : `Meter: ${km(ride.riddenDistanceM)} · ${fmt(ride.baseFareRwf)} + ${fmt(ride.perKmRwf)}/km`}
                </div>
              </div>

              {/* Navigate to the pickup, then (if given) to the destination */}
              {["ASSIGNED", "ARRIVED", "IN_RIDE"].includes(ride.status) && (
                <div style={{ marginBottom: 12 }}>
                  <NavigationMap
                    destination={
                      ride.status === "IN_RIDE" && ride.destLat != null && ride.destLng != null
                        ? { latitude: ride.destLat, longitude: ride.destLng, label: ride.destName || "Destination" }
                        : { latitude: ride.pickupLat, longitude: ride.pickupLng, label: ride.pickupName || "Pickup" }
                    }
                  />
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                {ride.status === "ASSIGNED" && (
                  <button disabled={busy} onClick={() => act(() => motariArrived(ride.id, token()))} style={primaryBtn(!busy)}>
                    I've arrived at the pickup
                  </button>
                )}
                {ride.status === "ARRIVED" && (
                  <button disabled={busy} onClick={() => act(() => motariStart(ride.id, token()))} style={primaryBtn(!busy)}>
                    Passenger on board — start ride
                  </button>
                )}
                {ride.status === "IN_RIDE" && (
                  <button disabled={busy} onClick={() => act(() => motariComplete(ride.id, token()))} style={primaryBtn(!busy)}>
                    <CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
                    Complete ride
                  </button>
                )}
                {ride.status === "COMPLETED" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={busy} onClick={() => act(() => motariPaid(ride.id, "CASH", token()))} style={{ ...primaryBtn(!busy), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Banknote size={14} /> Paid cash
                    </button>
                    <button disabled={busy} onClick={() => act(() => motariPaid(ride.id, "MOMO", token()))} style={{ ...primaryBtn(!busy), background: busy ? "#3a2a1c" : "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Smartphone size={14} /> Paid by MoMo
                    </button>
                  </div>
                )}
                {["ASSIGNED", "ARRIVED"].includes(ride.status) && (
                  <button disabled={busy} onClick={() => act(() => motariCancelRide(ride.id, undefined, token()))} style={{
                    background: "transparent", color: "#f87171", borderRadius: 999, padding: "10px 22px",
                    fontWeight: 700, fontSize: 13, border: "1px solid #7f1d1d", cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <X size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 5 }} />
                    Hand this ride back
                  </button>
                )}
              </div>
            </div>
          ) : online ? (
            /* Nearby requests */
            <div style={{ ...box, marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>Nearby requests</h2>
              {(state.nearby?.length ?? 0) === 0 ? (
                <p style={{ color: "#666", fontSize: 13, margin: 0 }}>
                  No requests around you right now — stay online, this list refreshes automatically.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {state.nearby!.map(n => (
                    <div key={n.id} style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.pickupName || "Pinned pickup"}
                        </div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                          {km(n.distanceToPickupM)} away · {n.destName ? `to ${n.destName}` : "open destination"}
                          {n.quotedFareRwf != null && <b style={{ color: "#f97316" }}> · {fmt(n.quotedFareRwf)}</b>}
                        </div>
                      </div>
                      <button disabled={busy} onClick={() => act(() => acceptRide(n.id, token()))} style={{
                        background: "#f97316", color: "#fff", borderRadius: 999, padding: "9px 20px",
                        fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}>
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...box, marginBottom: 14, textAlign: "center", color: "#666", fontSize: 13 }}>
              Go online to see ride requests near you.
            </div>
          )}
        </>
      )}

      {error && <div style={{ color: "#f87171", fontSize: 13, marginTop: 10 }}>{error}</div>}
    </div>
  );
}
