"use client";

import dynamic from "next/dynamic";

export interface TrackPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface TrackMapProps {
  pickup: TrackPoint;
  destination?: TrackPoint | null;
  driver?: TrackPoint | null;
}

/**
 * Passenger-side live map: pickup pin, optional destination pin, and the motari's
 * moving position. Leaflet touches `window`, so the real map loads client-side only.
 */
const TrackMapInner = dynamic(() => import("./TrackMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] flex items-center justify-center"
      style={{ height: 320 }}
    >
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
    </div>
  ),
});

export function TrackMap(props: TrackMapProps) {
  return <TrackMapInner {...props} />;
}
