"use client";

import { LocationPicker } from "@/components/map/LocationPicker";
import { type LocationData } from "@/lib/geocoding";

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

/**
 * Backward compatibility wrapper for Leaflet transition.
 * Wraps Leaflet LocationPicker component.
 */
export function MapPicker({ lat, lng, onChange }: Props) {
  const value: LocationData | undefined = (lat != null && lng != null) ? {
    latitude: lat,
    longitude: lng,
    address: ""
  } : undefined;

  const handleChange = (loc: LocationData) => {
    onChange(loc.latitude, loc.longitude);
  };

  return <LocationPicker value={value} onChange={handleChange} />;
}
