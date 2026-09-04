"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import { osmStyle } from "./osm-style";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
}

export function CampsiteMap({
  markers,
  selectedId,
  onMarkerClick,
  fallbackCenter = { latitude: 51.1657, longitude: 10.4515 }, // Deutschland
  fallbackZoom = 4.5,
}: {
  markers: MapMarker[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  fallbackCenter?: { latitude: number; longitude: number };
  fallbackZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const first = markers[0];
    const center: [number, number] = first
      ? [first.longitude, first.latitude]
      : [fallbackCenter.longitude, fallbackCenter.latitude];

    const map = new MapLibreMap({
      container: containerRef.current,
      style: osmStyle,
      center,
      zoom: first ? 6 : fallbackZoom,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    for (const m of markers) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", m.label);
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.4)";
      el.style.cursor = "pointer";
      el.style.background = m.id === selectedId ? "#059669" : "#10b981";
      el.onclick = () => onMarkerClick?.(m.id);

      const marker = new Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(map);
      markersRef.current.set(m.id, marker);
    }

    if (markers.length > 1) {
      const bounds = markers.reduce(
        (b, m) => b.extend([m.longitude, m.latitude]),
        new LngLatBounds(
          [markers[0].longitude, markers[0].latitude],
          [markers[0].longitude, markers[0].latitude]
        )
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    } else if (markers.length === 1) {
      map.flyTo({ center: [markers[0].longitude, markers[0].latitude], zoom: 10 });
    }
  }, [markers, selectedId, onMarkerClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
