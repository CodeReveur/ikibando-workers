export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
}

// Simple in-memory cache to store the last reverse geocoding results
const geocodeCache = new Map<string, LocationData>();
const forwardCache = new Map<string, { latitude: number; longitude: number } | null>();

/**
 * Forward-geocodes a place name (e.g. "Nyarutovu, Karama, Kanombe, Kicukiro, Rwanda") into
 * coordinates via OpenStreetMap Nominatim, restricted to Rwanda. Returns null on no match or error
 * so callers can fall back to a broader query. Never throws.
 */
export async function forwardGeocode(
  query: string
): Promise<{ latitude: number; longitude: number } | null> {
  const q = (query || "").trim();
  if (!q) return null;
  if (forwardCache.has(q)) return forwardCache.get(q)!;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=rw&q=${encodeURIComponent(q)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Ikibando-Workers-MpahMapu-App" },
    });
    if (!response.ok) throw new Error(`Nominatim search error: status ${response.status}`);
    const data = await response.json();
    const hit = Array.isArray(data) && data.length > 0
      ? { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }
      : null;
    const valid = hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude) ? hit : null;
    forwardCache.set(q, valid);
    return valid;
  } catch (error) {
    console.error("Forward geocoding failed:", error);
    return null;
  }
}

/**
 * Reverse geocodes a latitude and longitude into a structured location address
 * using the public OpenStreetMap Nominatim API.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<LocationData> {
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  
  // Check in-memory cache to prevent redundant network requests and improve performance
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;

  try {
    const response = await fetch(url, {
      headers: {
        // Nominatim requests require an identifiable User-Agent header
        "User-Agent": "Ikibando-Workers-MpahMapu-App"
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: status ${response.status}`);
    }

    const data = await response.json();
    const details = data.address || {};

    const location: LocationData = {
      latitude,
      longitude,
      address: data.display_name || "Unknown Address",
      city: details.city || details.town || details.village || details.suburb || "",
      district: details.county || details.district || details.city_district || "",
      state: details.state || details.region || "",
      country: details.country || ""
    };

    // Cache the resolved location data
    geocodeCache.set(cacheKey, location);

    return location;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    // Fallback gracefully without crashing
    return {
      latitude,
      longitude,
      address: `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
    };
  }
}

/** One suggestion from a place search — enough to pin it and show a readable label. */
export interface PlaceSuggestion {
  latitude: number;
  longitude: number;
  /** Short display label, e.g. "Kimironko Market, Gasabo". */
  label: string;
  /** Full Nominatim display name for disambiguation. */
  fullName: string;
}

const suggestCache = new Map<string, PlaceSuggestion[]>();

/**
 * Multi-result place search for type-ahead pickers: the user types, sees
 * candidates, and picks the right one. Runs through our own /api/places proxy,
 * so results are identified, cached and biased to the user's area instead of
 * being throttled by Nominatim. Never throws - returns [] on any failure.
 *
 * @param near optional current position, used to rank nearby places first
 */
export async function searchPlaces(
  query: string,
  near?: { latitude: number; longitude: number } | null,
): Promise<PlaceSuggestion[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const key = near ? q + '|' + near.latitude.toFixed(2) + ',' + near.longitude.toFixed(2) : q;
  if (suggestCache.has(key)) return suggestCache.get(key)!;

  const params = new URLSearchParams({ q });
  if (near) {
    params.set('lat', String(near.latitude));
    params.set('lng', String(near.longitude));
  }
  try {
    const response = await fetch('/api/places?' + params);
    if (!response.ok) return [];
    const out = (await response.json()) as PlaceSuggestion[];
    suggestCache.set(key, out);
    return out;
  } catch (error) {
    console.error('Place search failed:', error);
    return [];
  }
}
