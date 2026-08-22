"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MotariMapProps, MapPoint } from "./MotariMap";

const KIGALI: [number, number] = [-1.9441, 30.0619];

const pin = (bg: string, glyph: string, size = 32) =>
  L.divIcon({
    className: "motari-pin",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
           background:${bg};border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.5);
           display:flex;align-items:center;justify-content:center">
           <span style="transform:rotate(45deg);font-size:${Math.round(size * 0.45)}px;line-height:1">${glyph}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

const pickupIcon = pin("#f97316", "📍");
const destIcon = pin("#16a34a", "🏁");
const driverIcon = L.divIcon({
  className: "motari-driver",
  html: `<div style="width:34px;height:34px;border-radius:50%;background:#111;border:2px solid #f97316;
         box-shadow:0 2px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;
         font-size:17px;line-height:1">🏍️</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

/**
 * Re-frames the view when the *set* of things on the map changes (pickup chosen,
 * destination added, driver appeared, route drawn) — not on every driver tick,
 * so a panning passenger isn't fought by the camera.
 */
function Reframe({ pickup, destination, driver, self, extras, routeLen }: {
  pickup?: MapPoint | null; destination?: MapPoint | null; driver?: MapPoint | null;
  self?: MapPoint | null; extras?: MapPoint[] | null; routeLen: number;
}) {
  const map = useMap();
  // The device dot centers the map only while nothing else is placed: once a
  // pickup or ride exists, those own the frame and the dot just follows along.
  const hasTrip = !!pickup || !!destination;
  const selfLeads = !!self && !hasTrip && !driver;
  // Waiting passengers only widen the frame while there is no trip in progress.
  const waiting = !hasTrip ? (extras ?? []) : [];
  const signature = [!!pickup, !!destination, !!driver, routeLen > 0, selfLeads, waiting.length].join("|");
  const lastSig = useRef("");
  useEffect(() => {
    if (signature === lastSig.current) return;
    lastSig.current = signature;
    const pts: [number, number][] = [];
    if (pickup) pts.push([pickup.latitude, pickup.longitude]);
    if (destination) pts.push([destination.latitude, destination.longitude]);
    if (driver) pts.push([driver.latitude, driver.longitude]);
    waiting.forEach(w => pts.push([w.latitude, w.longitude]));
    if (pts.length === 0 && selfLeads && self) pts.push([self.latitude, self.longitude]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.flyTo(pts[0], 16, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16, duration: 0.8 });
  }, [signature, pickup, destination, driver, self, map]);
  return null;
}

/**
 * GPS accuracy circle managed imperatively: react-leaflet's <Circle> can mount
 * against a map that dev-mode remounting already destroyed (its panes are gone,
 * crashing with "reading 'appendChild'"); adding via the map instance with a
 * guarded effect and proper cleanup sidesteps that entirely.
 */
function AccuracyCircle({ center, radius }: { center: MapPoint; radius: number }) {
  const map = useMap();
  const circleRef = useRef<L.Circle | null>(null);
  useEffect(() => {
    let circle: L.Circle | null = null;
    try {
      circle = L.circle([center.latitude, center.longitude], {
        radius,
        color: "#3b82f6", weight: 1, opacity: 0.35,
        fillColor: "#3b82f6", fillOpacity: 0.08,
      }).addTo(map);
      circleRef.current = circle;
    } catch { /* map torn down mid-mount: skip drawing this cycle */ }
    return () => { try { circle?.remove(); } catch {} circleRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  useEffect(() => {
    circleRef.current?.setLatLng([center.latitude, center.longitude]);
    circleRef.current?.setRadius(radius);
  }, [center.latitude, center.longitude, radius]);
  return null;
}

function TapToPick({ onPick }: { onPick?: (p: MapPoint) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

// "You are here": blue dot with a soft pulsing halo (keyframes live in the page CSS).
const selfIcon = L.divIcon({
  className: "motari-self",
  html: `<div style="position:relative;width:18px;height:18px">
           <div style="position:absolute;inset:-9px;border-radius:50%;background:rgba(59,130,246,0.25);animation:gpspulse 2s ease-out infinite"></div>
           <div style="position:absolute;inset:2px;border-radius:50%;background:#3b82f6;border:2.5px solid #fff;box-shadow:0 1px 8px rgba(0,0,0,0.5)"></div>
         </div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// A passenger waiting for a moto: a teardrop pin holding a simple person glyph,
// drawn rather than an emoji so it reads the same on every device.
const waitingIcon = L.divIcon({
  className: "motari-waiting",
  html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
           background:#f97316;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.55);
           display:flex;align-items:center;justify-content:center">
           <svg viewBox="0 0 24 24" width="15" height="15" fill="#fff" style="transform:rotate(45deg)"
                aria-hidden="true">
             <circle cx="12" cy="7.5" r="3.6"/>
             <path d="M12 12.6c-3.6 0-6.4 2.1-6.4 4.7v1.3h12.8v-1.3c0-2.6-2.8-4.7-6.4-4.7z"/>
           </svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export default function MotariMapInner({ pickup, destination, driver, route, extras, self, selfAccuracyM, onPick, onExtraClick }: MotariMapProps) {
  return (
    <MapContainer
      center={KIGALI}
      zoom={14}
      zoomControl={false}
      style={{ position: "absolute", inset: 0, background: "#141414" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Reframe pickup={pickup} destination={destination} driver={driver} self={self} extras={extras} routeLen={route?.length ?? 0} />
      <TapToPick onPick={onPick} />
      {route && route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: "#111", weight: 7, opacity: 0.35 }} />
          <Polyline positions={route} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.95 }} />
        </>
      )}
      {pickup && <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon} />}
      {destination && <Marker position={[destination.latitude, destination.longitude]} icon={destIcon} />}
      {driver && <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon} />}
      {extras?.map((p, i) => (
        <Marker
          key={p.id ?? i}
          position={[p.latitude, p.longitude]}
          icon={waitingIcon}
          zIndexOffset={300}
          eventHandlers={p.id && onExtraClick ? { click: () => onExtraClick(p.id!) } : undefined}
        >
          {p.label && (
            <Tooltip direction="top" offset={[0, -26]} opacity={1} permanent={extras.length <= 3}>
              {p.label}
            </Tooltip>
          )}
        </Marker>
      ))}
      {/* Accuracy circle around whichever marker represents this device: the blue
          dot (passenger) or, when only an accuracy is given, the moto (driver). */}
      {(() => {
        const anchor = self ?? (selfAccuracyM != null ? driver : null);
        return anchor
          ? <AccuracyCircle center={anchor} radius={Math.max(10, selfAccuracyM ?? 10)} />
          : null;
      })()}
      {self && <Marker position={[self.latitude, self.longitude]} icon={selfIcon} zIndexOffset={500} />}
    </MapContainer>
  );
}
