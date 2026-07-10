"use client";

import dynamic from "next/dynamic";
import { type NavigationDestination } from "./LeafletNavigationMap";

/**
 * Leaflet depends on browser globals, so the navigation map is loaded client-side only.
 * Gives workers live, turn-by-turn walking/driving guidance to a job's location with
 * fresh GPS, an on-map route, distance/ETA, and optional voice ("turn left/right").
 */
const LeafletNavigationMap = dynamic(() => import("./LeafletNavigationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] flex flex-col items-center justify-center gap-3"
      style={{ height: "100%", minHeight: 420 }}
    >
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
      <span className="text-xs text-[#555] font-medium">Loading navigation…</span>
    </div>
  ),
});

export type { NavigationDestination };

export function NavigationMap({ destination }: { destination: NavigationDestination }) {
  return <LeafletNavigationMap destination={destination} />;
}
