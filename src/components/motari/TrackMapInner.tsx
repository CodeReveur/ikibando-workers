"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TrackMapProps } from "./TrackMap";

const KIGALI: [number, number] = [-1.9441, 30.0619];

const pin = (bg: string, glyph: string) =>
  L.divIcon({
    className: "motari-pin",
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${bg};border:2px solid #fff;
           box-shadow:0 2px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;
           font-size:14px;line-height:1">${glyph}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const pickupIcon = pin("#f97316", "📍");
const destIcon = pin("#16a34a", "🏁");
const driverIcon = pin("#111", "🏍️");

/** Keeps every marker in view as the driver moves, without fighting the user's zoom each tick. */
function FitOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // Re-fit only when the set of points changes size (driver appears, dest added) —
    // not on every position tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export default function TrackMapInner({ pickup, destination, driver }: TrackMapProps) {
  const points: [number, number][] = [[pickup.latitude, pickup.longitude]];
  if (destination) points.push([destination.latitude, destination.longitude]);
  if (driver) points.push([driver.latitude, driver.longitude]);

  return (
    <MapContainer
      center={KIGALI}
      zoom={14}
      style={{ height: 320, width: "100%", borderRadius: 12 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitOnce points={points} />
      <Marker position={[pickup.latitude, pickup.longitude]} icon={pickupIcon} />
      {destination && <Marker position={[destination.latitude, destination.longitude]} icon={destIcon} />}
      {driver && <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon} />}
    </MapContainer>
  );
}
