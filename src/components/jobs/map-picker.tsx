"use client";

import { useEffect, useRef } from "react";

const KIGALI = { lat: -1.9441, lng: 30.0619 };

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry",                 stylers: [{ color: "#1e1e1e" }] },
  { elementType: "labels.text.stroke",       stylers: [{ color: "#141414" }] },
  { elementType: "labels.text.fill",         stylers: [{ color: "#777" }] },
  { featureType: "road",          elementType: "geometry",        stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road",          elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill",stylers: [{ color: "#888" }] },
  { featureType: "road.highway",  elementType: "geometry",        stylers: [{ color: "#3c3c3c" }] },
  { featureType: "road.highway",  elementType: "labels.text.fill",stylers: [{ color: "#999" }] },
  { featureType: "water",         elementType: "geometry",        stylers: [{ color: "#111" }] },
  { featureType: "poi",                      stylers: [{ visibility: "off" }] },
  { featureType: "transit",                  stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#333" }] },
];

// Module-level singleton — loads the script only once across all MapPicker instances
let mapsLoaded: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (!mapsLoaded) {
    mapsLoaded = new Promise<void>((resolve, reject) => {
      if (window.google?.maps?.Map) { resolve(); return; }
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload  = () => resolve();
      s.onerror = () => { mapsLoaded = null; reject(new Error("Google Maps script failed to load")); };
      document.head.appendChild(s);
    });
  }
  return mapsLoaded;
}

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

export function MapPicker({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    loadGoogleMaps()
      .then(() => {
        if (!mountedRef.current || !containerRef.current) return;

        const center = lat != null && lng != null ? { lat, lng } : KIGALI;

        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom:              13,
          mapTypeControl:    false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl:       true,
          styles:            DARK_STYLE,
        });

        const marker = new google.maps.Marker({
          position: center,
          map,
          draggable: true,
          icon: {
            path:         google.maps.SymbolPath.CIRCLE,
            fillColor:    "#f97316",
            fillOpacity:  1,
            strokeColor:  "#fff",
            strokeWeight: 2,
            scale:        8,
          },
        });

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) onChange(pos.lat(), pos.lng());
        });

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          marker.setPosition(e.latLng);
          onChange(e.latLng.lat(), e.latLng.lng());
        });

        mapRef.current    = map;
        markerRef.current = marker;
      })
      .catch((err) => console.error("Google Maps failed to load:", err));

    return () => {
      mountedRef.current = false;
      mapRef.current     = null;
      markerRef.current  = null;
    };
  }, []);

  useEffect(() => {
    if (lat != null && lng != null && markerRef.current && mapRef.current) {
      const pos = { lat, lng };
      markerRef.current.setPosition(pos);
      mapRef.current.panTo(pos);
      mapRef.current.setZoom(15);
    }
  }, [lat, lng]);

  return (
    /* isolation:isolate contains Google Maps' internal z-indices so they
       can't bleed over dropdowns/buttons rendered outside this element */
    <div style={{ position: "relative", isolation: "isolate" }}>
      <div
        ref={containerRef}
        style={{
          height: 220, width: "100%",
          borderRadius: 10, border: "1px solid #2a2a2a",
          overflow: "hidden",
        }}
      />
    </div>
  );
}
