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
