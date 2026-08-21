"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
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
function Reframe({ pickup, destination, driver, self, routeLen }: {
  pickup?: MapPoint | null; destination?: MapPoint | null; driver?: MapPoint | null;
  self?: MapPoint | null; routeLen: number;
}) {
  const map = useMap();
  // The device dot centers the map only while nothing else is placed: once a
  // pickup or ride exists, those own the frame and the dot just follows along.
  const selfLeads = !!self && !pickup && !destination && !driver;
  const signature = [!!pickup, !!destination, !!driver, routeLen > 0, selfLeads].join("|");
  const lastSig = useRef("");
  useEffect(() => {
    if (signature === lastSig.current) return;
    lastSig.current = signature;
    const pts: [number, number][] = [];
    if (pickup) pts.push([pickup.latitude, pickup.longitude]);
    if (destination) pts.push([destination.latitude, destination.longitude]);
    if (driver) pts.push([driver.latitude, driver.longitude]);
    if (pts.length === 0 && selfLeads && self) pts.push([self.latitude, self.longitude]);
    if (pts.length === 0) return;
    if (pts.length === 1) map.flyTo(pts[0], 16, { duration: 0.8 });
    else map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], duration: 0.8 });
  }, [signature, pickup, destination, driver, self, map]);
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

const extraIcon = L.divIcon({
  className: "motari-extra",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#f97316;border:2px solid #fff;
         box-shadow:0 1px 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function MotariMapInner({ pickup, destination, driver, route, extras, self, onPick }: MotariMapProps) {
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
      <Reframe pickup={pickup} destination={destination} driver={driver} self={self} routeLen={route?.length ?? 0} />
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
        <Marker key={i} position={[p.latitude, p.longitude]} icon={extraIcon} />
      ))}
      {self && <Marker position={[self.latitude, self.longitude]} icon={selfIcon} zIndexOffset={500} />}
    </MapContainer>
  );
}
