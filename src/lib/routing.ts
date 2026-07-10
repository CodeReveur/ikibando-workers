/**
 * Turn-by-turn routing via the public OSRM API (OpenStreetMap Routing Machine).
 * Returns the road geometry, total distance/time, and step-by-step maneuvers with
 * human + voice-ready instructions. Never throws — returns null on failure so the
 * caller can degrade gracefully to a straight-line hint.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  /** Human-readable instruction, e.g. "Turn right onto KG 7 Ave". */
  instruction: string;
  /** Short phrase spoken aloud, e.g. "Turn right onto KG 7 Avenue". */
  voice: string;
  /** OSRM maneuver type (turn, depart, arrive, roundabout, …). */
  type: string;
  /** left / right / straight / slight left / … (may be empty). */
  modifier: string;
  /** Road/street name for this step (may be empty). */
  name: string;
  /** Length of this step in metres. */
  distanceM: number;
  /** Where the maneuver happens. */
  location: LatLng;
}

export interface RouteResult {
  distanceM: number;
  durationS: number;
  /** Full road geometry as [lat, lng] pairs (ready for Leaflet Polyline). */
  coordinates: [number, number][];
  steps: RouteStep[];
}

/** Human distance, e.g. "1.8 km" or "240 m". */
export function fmtDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
  return `${Math.round(m)} m`;
}

/** Human duration, e.g. "20 min" or "1 h 05 min". */
export function fmtDuration(s: number): string {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Great-circle distance in metres between two points (Haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function phraseFor(type: string, modifier: string, name: string): { instruction: string; voice: string } {
  const road = name && name.trim() ? name.trim() : "";
  const onto = road ? ` onto ${road}` : "";
  const mod = (modifier || "").toLowerCase();

  const dir = (): string => {
    if (mod.includes("left"))  return mod.includes("slight") ? "turn slightly left" : mod.includes("sharp") ? "turn sharply left" : "turn left";
    if (mod.includes("right")) return mod.includes("slight") ? "turn slightly right" : mod.includes("sharp") ? "turn sharply right" : "turn right";
    if (mod.includes("straight") || mod.includes("uturn")) return mod.includes("uturn") ? "make a U-turn" : "continue straight";
    return "continue";
  };

  let base: string;
  switch (type) {
    case "depart":     base = road ? `Head out on ${road}` : "Start heading toward your destination"; break;
    case "arrive":     base = "You have arrived at your destination"; break;
    case "roundabout":
    case "rotary":     base = `At the roundabout, take the exit${onto}`; break;
    case "merge":      base = `Merge${onto}`; break;
    case "fork":       base = `Keep ${mod.includes("left") ? "left" : mod.includes("right") ? "right" : "straight"}${onto}`; break;
    case "on ramp":    base = `Take the ramp${onto}`; break;
    case "off ramp":   base = `Take the exit${onto}`; break;
    case "end of road":base = `${dir()[0].toUpperCase()}${dir().slice(1)}${onto}`; break;
    case "continue":   base = `Continue${onto}`; break;
    case "new name":   base = road ? `Continue onto ${road}` : "Continue"; break;
    default:           base = `${dir()[0].toUpperCase()}${dir().slice(1)}${onto}`;
  }
  return { instruction: base, voice: base };
}

/**
 * Fetch a driving route from `from` to `to`. Uses the demo OSRM server; for production
 * traffic point this at a self-hosted OSRM or a keyed provider.
 */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    const coordinates: [number, number][] = (route.geometry?.coordinates ?? []).map(
      (c: [number, number]) => [c[1], c[0]] as [number, number]
    );

    const steps: RouteStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const m = s.maneuver ?? {};
        const { instruction, voice } = phraseFor(m.type ?? "", m.modifier ?? "", s.name ?? "");
        steps.push({
          instruction,
          voice,
          type: m.type ?? "",
          modifier: m.modifier ?? "",
          name: s.name ?? "",
          distanceM: s.distance ?? 0,
          location: { latitude: m.location?.[1] ?? to.latitude, longitude: m.location?.[0] ?? to.longitude },
        });
      }
    }

    return {
      distanceM: route.distance ?? 0,
      durationS: route.duration ?? 0,
      coordinates,
      steps,
    };
  } catch (e) {
    console.error("Routing failed:", e);
    return null;
  }
}
