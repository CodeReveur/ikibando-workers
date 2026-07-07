"use client";

import dynamic from "next/dynamic";
import { type LocationData } from "@/lib/geocoding";

/**
 * Next.js pre-renders pages on the server (Server-Side Rendering / SSR).
 * Since Leaflet relies on browser-only API globals like `window` and `document`,
 * attempting to load it server-side will cause `window is not defined` errors.
 *
 * To avoid this, we use dynamic imports with `{ ssr: false }` to delay loading
 * the leaflet rendering component until it reaches the client-side browser context.
 */
const LeafletLocationMap = dynamic(
  () => import("./LeafletLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div 
        className="w-full rounded-xl border border-[#2a2a2a] bg-[#141414] flex flex-col items-center justify-center gap-3 shadow-md"
        style={{ height: "450px" }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#f97316] animate-spin" />
        <span className="text-xs text-[#555] font-medium font-sans">Initializing Interactive Map…</span>
      </div>
    ),
  }
);

interface LocationPickerProps {
  value?: LocationData;
  onChange?: (location: LocationData) => void;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  return <LeafletLocationMap value={value} onChange={onChange} />;
}
