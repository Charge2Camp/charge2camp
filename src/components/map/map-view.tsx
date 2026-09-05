"use client";

import { useEffect, useRef } from "react";
import { GeoJSONSource, LngLatBounds, MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import { osmStyle } from "./osm-style";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  color?: string;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

const DEFAULT_COLOR = "#10b981";
const SELECTED_COLOR = "#059669";
const ROUTE_SOURCE_ID = "route";
const ROUTE_LAYER_ID = "route-line";

export function MapView({
  markers,
  route,
  selectedId,
  onMarkerClick,
  fallbackCenter = { latitude: 51.1657, longitude: 10.4515 }, // Deutschland
  fallbackZoom = 4.5,
}: {
  markers: MapMarker[];
  route?: RoutePoint[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  fallbackCenter?: { latitude: number; longitude: number };
  fallbackZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const loadedRef = useRef(false);

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
    map.on("load", () => {
      loadedRef.current = true;
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
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
      el.style.background = m.id === selectedId ? SELECTED_COLOR : (m.color ?? DEFAULT_COLOR);
      el.onclick = () => onMarkerClick?.(m.id);

      const marker = new Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(map);
      markersRef.current.set(m.id, marker);
    }

    const routeCoords = route?.map((p): [number, number] => [p.longitude, p.latitude]) ?? [];

    function drawRoute() {
      if (!map) return;
      const geojson = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: routeCoords },
      };
      const source = map.getSource(ROUTE_SOURCE_ID);
      if (routeCoords.length > 1) {
        if (source instanceof GeoJSONSource) {
          source.setData(geojson);
        } else {
          map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: geojson });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#059669", "line-width": 4 },
          });
        }
      } else if (source) {
        map.removeLayer(ROUTE_LAYER_ID);
        map.removeSource(ROUTE_SOURCE_ID);
      }
    }

    if (loadedRef.current) {
      drawRoute();
    } else {
      map.once("load", drawRoute);
    }

    const boundsPoints = routeCoords.length > 0 ? routeCoords : markers.map((m) => [m.longitude, m.latitude] as [number, number]);

    if (boundsPoints.length > 1) {
      const bounds = boundsPoints.reduce(
        (b, p) => b.extend(p),
        new LngLatBounds(boundsPoints[0], boundsPoints[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    } else if (boundsPoints.length === 1) {
      map.flyTo({ center: boundsPoints[0], zoom: 10 });
    }
  }, [markers, route, selectedId, onMarkerClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
