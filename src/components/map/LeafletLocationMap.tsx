"use client";

import { useEffect, useState, useTransition } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import { Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { reverseGeocode, type LocationData } from "@/lib/geocoding";

// Fix missing marker icons issue in Next.js environment by mapping default assets to CDN
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LeafletLocationMapProps {
  value?: LocationData;
  onChange?: (location: LocationData) => void;
}

const DEFAULT_CENTER: [number, number] = [-1.9441, 30.0619];

// Component to dynamically pan/center map when position changes
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LeafletLocationMap({ value, onChange }: LeafletLocationMapProps) {
  const [position, setPosition] = useState<[number, number]>(
    value ? [value.latitude, value.longitude] : DEFAULT_CENTER
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(value?.address || "");
  const [locationDetails, setLocationDetails] = useState<LocationData | null>(value || null);
  const [loading, startTransition] = useTransition();

  // Sync state if initial or external value changes
  useEffect(() => {
    if (value) {
      setPosition([value.latitude, value.longitude]);
      setResolvedAddress(value.address);
      setLocationDetails(value);
    }
  }, [value]);

  // Click handler sub-component that binds map click actions
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        
        startTransition(async () => {
          try {
            const geocoded = await reverseGeocode(lat, lng);
            setLocationDetails(geocoded);
            setResolvedAddress(geocoded.address);
            if (onChange) {
              onChange(geocoded);
            }
          } catch (err) {
            console.error("Failed to reverse geocode click coordinates:", err);
          }
        });
      },
    });
    return null;
  }

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-left">
      <div 
        className="w-full rounded-xl overflow-hidden shadow-md border border-[#2a2a2a] bg-[#141414]"
        style={{ height: "320px", position: "relative" }}
      >
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer name="Map View">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="dark-map-tiles"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer checked name="Satellite View">
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <Marker position={position}>
            <Popup>
              <div className="text-xs font-semibold text-black p-0.5">
                Lat: {position[0].toFixed(5)} <br />
                Lng: {position[1].toFixed(5)}
              </div>
            </Popup>
          </Marker>
          <MapEvents />
          <MapRecenter center={position} />
        </MapContainer>

        {/* Global styling overrides for dark theme maps */}
        <style jsx global>{`
          .dark-map-tiles {
            filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
          }
          .leaflet-container {
            background: #141414 !important;
          }
          .leaflet-bar {
            border: 1px solid #2a2a2a !important;
          }
          .leaflet-bar a {
            background-color: #1a1a1a !important;
            color: #d0d0d0 !important;
            border-bottom: 1px solid #2a2a2a !important;
          }
          .leaflet-bar a:hover {
            background-color: #252525 !important;
            color: #fff !important;
          }
          .leaflet-control-layers {
            background: #1a1a1a !important;
            color: #d0d0d0 !important;
            border: 1px solid #2a2a2a !important;
          }
          .leaflet-control-layers-list {
            color: #d0d0d0 !important;
          }
        `}</style>
      </div>

      <div className="p-5 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-sm flex flex-col gap-4 font-sans text-left">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#666] m-0 mb-1">
            Selected Location
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[#aaa] py-1">
              <Loader2 className="animate-spin text-[#f97316]" size={14} />
              <span>Resolving coordinates...</span>
            </div>
          ) : (
            <p className="text-sm text-[#f0f0f0] m-0 leading-relaxed font-bold">
              {resolvedAddress || "Click on the map to choose a location"}
            </p>
          )}
        </div>

        {locationDetails && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pt-3 border-t border-[#252525] text-xs">
            <div>
              <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">Latitude</span>
              <span className="text-[#aaa] font-mono">{locationDetails.latitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">Longitude</span>
              <span className="text-[#aaa] font-mono">{locationDetails.longitude.toFixed(6)}</span>
            </div>
            {locationDetails.district && (
              <div>
                <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">District</span>
                <span className="text-[#aaa]">{locationDetails.district}</span>
              </div>
            )}
            {locationDetails.city && (
              <div>
                <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">City / Town</span>
                <span className="text-[#aaa]">{locationDetails.city}</span>
              </div>
            )}
            {locationDetails.state && (
              <div>
                <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">Province / State</span>
                <span className="text-[#aaa]">{locationDetails.state}</span>
              </div>
            )}
            {locationDetails.country && (
              <div>
                <span className="text-[#666] block font-bold uppercase tracking-wide mb-0.5">Country</span>
                <span className="text-[#aaa]">{locationDetails.country}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
