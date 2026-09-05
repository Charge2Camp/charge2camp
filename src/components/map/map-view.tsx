"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
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
const ROUTE_LINE_COLOR = "#059669";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const routeRef = useRef<RoutePoint[] | undefined>(undefined);

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

    // Route wird bewusst NICHT als MapLibre-GeoJSON-Source/Layer gezeichnet
    // (das erfordert einen Web Worker fuer das Tiling; in manchen
    // eingebetteten/sandboxten Browserumgebungen startet dieser Worker nicht
    // und die Linie bleibt unsichtbar, siehe git-history). Stattdessen wird
    // die Route auf einem eigenen <canvas> ueber der Karte gezeichnet, per
    // map.project() synchron zur Kartenposition -- funktioniert ohne Worker.
    function drawRouteOverlay() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = map.getContainer().clientWidth;
      const height = map.getContainer().clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const currentRoute = routeRef.current;
      if (!currentRoute || currentRoute.length < 2) return;

      ctx.beginPath();
      currentRoute.forEach((point, index) => {
        const { x, y } = map.project([point.longitude, point.latitude]);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = ROUTE_LINE_COLOR;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    map.on("move", drawRouteOverlay);
    map.on("resize", drawRouteOverlay);
    map.on("render", drawRouteOverlay);
    map.on("load", drawRouteOverlay);

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
      el.style.background = m.id === selectedId ? SELECTED_COLOR : (m.color ?? DEFAULT_COLOR);
      el.onclick = () => onMarkerClick?.(m.id);

      const marker = new Marker({ element: el })
        .setLngLat([m.longitude, m.latitude])
        .addTo(map);
      markersRef.current.set(m.id, marker);
    }

    routeRef.current = route;
    map.fire("render");

    const routeCoords = route?.map((p): [number, number] => [p.longitude, p.latitude]) ?? [];
    const boundsPoints =
      routeCoords.length > 0 ? routeCoords : markers.map((m) => [m.longitude, m.latitude] as [number, number]);

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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
    </div>
  );
}
