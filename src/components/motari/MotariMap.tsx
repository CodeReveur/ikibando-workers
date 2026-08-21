"use client";

import dynamic from "next/dynamic";

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MotariMapProps {
  pickup?: MapPoint | null;
  destination?: MapPoint | null;
  driver?: MapPoint | null;
  /** Road geometry between pickup and destination, ready for a polyline. */
  route?: [number, number][] | null;
  /** Extra small markers, e.g. pickups of passengers currently seeking a ride. */
  extras?: MapPoint[] | null;
  /** Fired when the user taps the map with no pickup set yet (pin-drop fallback). */
  onPick?: (p: MapPoint) => void;
}

/**
 * The full-screen Ask Motari map. Leaflet needs `window`, so the real map mounts
 * client-side only; until then the dark ground just holds the space.
 */
const MotariMapInner = dynamic(() => import("./MotariMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, background: "#141414", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
    </div>
  ),
});

export function MotariMap(props: MotariMapProps) {
  return <MotariMapInner {...props} />;
}
