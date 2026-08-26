"use client";

import dynamic from "next/dynamic";

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** A waiting passenger on the driver's map: pin plus a short label. */
export interface ExtraPoint extends MapPoint {
  id?: string;
  label?: string;
}

export interface MotariMapProps {
  pickup?: MapPoint | null;
  destination?: MapPoint | null;
  driver?: MapPoint | null;
  /** Road geometry between pickup and destination, ready for a polyline. */
  route?: [number, number][] | null;
  /** Waiting passengers: pickup pins the driver can see and tap. */
  extras?: ExtraPoint[] | null;
  /** Fired when a waiting-passenger pin is tapped. */
  onExtraClick?: (id: string) => void;
  /** The device's live GPS position: a pulsing blue dot that follows the user. */
  self?: MapPoint | null;
  /** Reported accuracy of the fix in metres; drawn as a circle so a coarse
   *  network fix is visibly a guess, not a point. */
  selfAccuracyM?: number | null;
  /** Fired when the user taps the map with no pickup set yet (pin-drop fallback). */
  onPick?: (p: MapPoint) => void;
  /**
   * What the map is drawn on to begin with. A passenger describing where they
   * are standing is better served by satellite - a roof, a yard, the shape of
   * a junction - while a motari following a road is better served by streets.
   * Either way the switch is on the map and the choice is the user's.
   */
  defaultBasemap?: "streets" | "satellite";
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
