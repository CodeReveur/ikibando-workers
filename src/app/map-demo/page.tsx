"use client";

import { useState } from "react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { type LocationData } from "@/lib/geocoding";

export default function MapDemoPage() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | undefined>(undefined);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight m-0 text-white">
            Leaflet Map Picker Demo
          </h1>
          <p className="text-sm text-[#888] mt-2 mb-0">
            Click anywhere on the map below. It will automatically resolve the GPS coordinates using OpenStreetMap Nominatim reverse geocoding.
          </p>
        </div>

        <LocationPicker 
          value={selectedLocation} 
          onChange={setSelectedLocation} 
        />

        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold text-white m-0">
            Selected Location Data (JSON)
          </h3>
          <pre className="p-4 rounded-xl border border-[#2a2a2a] bg-[#141414] text-xs text-[#22c55e] overflow-x-auto leading-relaxed">
            {selectedLocation 
              ? JSON.stringify(selectedLocation, null, 2) 
              : "// No location selected yet. Click the map to choose a position."}
          </pre>
        </div>
      </div>
    </div>
  );
}
