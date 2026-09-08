"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import Supercluster, { type PointFeature } from "supercluster";
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
const CLUSTER_COLOR = "#059669";
const ROUTE_LINE_COLOR = "#059669";

type ClusterProps = { cluster: true; cluster_id: number; point_count: number };
type PointProps = { cluster: false; markerId: string; color?: string };

function buildIndividualMarkerElement(m: MapMarker, selected: boolean, onClick: () => void): HTMLButtonElement {
  // Sichtbarer Punkt bleibt bewusst klein (16px, passt zur Kartenoptik),
  // aber die Tap-Flaeche wird auf 44px (Apple HIG) vergroessert -- ein
  // umschliessendes, unsichtbares Button-Element zentriert den Punkt, ohne
  // die geografische Ankerposition zu veraendern (weiterhin mittig).
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", m.label);
  el.style.width = "44px";
  el.style.height = "44px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.background = "transparent";
  el.style.border = "none";
  el.style.padding = "0";
  el.style.cursor = "pointer";
  el.onclick = onClick;

  const dot = document.createElement("span");
  dot.style.width = "16px";
  dot.style.height = "16px";
  dot.style.borderRadius = "50%";
  dot.style.border = "2px solid white";
  dot.style.boxShadow = "0 1px 3px rgba(0,0,0,0.4)";
  dot.style.background = selected ? SELECTED_COLOR : (m.color ?? DEFAULT_COLOR);
  el.appendChild(dot);
  return el;
}

function buildClusterMarkerElement(pointCount: number, onClick: () => void): HTMLButtonElement {
  const size = pointCount < 10 ? 32 : pointCount < 100 ? 40 : 48;
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${pointCount} Treffer in diesem Bereich, antippen zum Heranzoomen`);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "50%";
  el.style.border = "2px solid white";
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
  el.style.background = CLUSTER_COLOR;
  el.style.color = "white";
  el.style.fontSize = "13px";
  el.style.fontWeight = "600";
  el.style.cursor = "pointer";
  el.textContent = pointCount > 999 ? "999+" : String(pointCount);
  el.onclick = onClick;
  return el;
}

export function MapView({
  markers,
  route,
  selectedId,
  onMarkerClick,
  cluster = false,
  fallbackCenter = { latitude: 51.1657, longitude: 10.4515 }, // Deutschland
  fallbackZoom = 4.5,
}: {
  markers: MapMarker[];
  route?: RoutePoint[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  /** Ab wie vielen Markern lohnt sich Clustering nicht (Routenplaner-
   * Ladestopps o. ae. bleiben bewusst unclustered -- da reichen wenige
   * Marker, individuelle Pins sind da klarer). Standard: aus. */
  cluster?: boolean;
  fallbackCenter?: { latitude: number; longitude: number };
  fallbackZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const routeRef = useRef<RoutePoint[] | undefined>(undefined);
  // Supercluster laeuft bewusst im Hauptthread (direkter Aufruf, nicht ueber
  // eine MapLibre-GeoJSON-Source mit cluster:true) -- letzteres wuerde
  // MapLibre's Geodaten-Worker verwenden, der in manchen eingebetteten/
  // sandboxten Browserumgebungen nicht startet (siehe Kommentar zur
  // Routenlinie oben in dieser Datei, git-history). So bleibt das Rendering
  // exakt dieselben DOM-Marker wie bisher, nur seltener/gebuendelt erzeugt.
  const indexRef = useRef<Supercluster<PointProps, ClusterProps> | null>(null);

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

    const clearMarkers = () => {
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
    };

    const renderIndividualMarkers = (items: MapMarker[]) => {
      clearMarkers();
      for (const m of items) {
        const el = buildIndividualMarkerElement(m, m.id === selectedId, () => onMarkerClick?.(m.id));
        const marker = new Marker({ element: el }).setLngLat([m.longitude, m.latitude]).addTo(map);
        markersRef.current.set(m.id, marker);
      }
    };

    const renderClustered = () => {
      const index = indexRef.current;
      if (!index) return;
      clearMarkers();
      const b = map.getBounds();
      const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const zoom = Math.round(map.getZoom());
      const results = index.getClusters(bbox, zoom);

      results.forEach((feature, i) => {
        const [longitude, latitude] = feature.geometry.coordinates;
        if (feature.properties.cluster) {
          const { cluster_id: clusterId, point_count: pointCount } = feature.properties;
          const el = buildClusterMarkerElement(pointCount, () => {
            const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 18);
            map.easeTo({ center: [longitude, latitude], zoom: expansionZoom });
          });
          const marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(`cluster-${clusterId}-${i}`, marker);
        } else {
          const { markerId } = feature.properties;
          const original = markers.find((m) => m.id === markerId);
          const el = buildIndividualMarkerElement(
            { id: markerId, latitude, longitude, label: original?.label ?? "", color: feature.properties.color },
            markerId === selectedId,
            () => onMarkerClick?.(markerId)
          );
          const marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(markerId, marker);
        }
      });
    };

    let renderFn: () => void;

    if (cluster) {
      const points: PointFeature<PointProps>[] = markers.map((m) => ({
        type: "Feature",
        properties: { cluster: false, markerId: m.id, color: m.color },
        geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
      }));
      const index = new Supercluster<PointProps, ClusterProps>({ radius: 60, maxZoom: 16 });
      index.load(points);
      indexRef.current = index;
      renderFn = renderClustered;
      map.on("moveend", renderFn);
      renderFn();
    } else {
      renderFn = () => renderIndividualMarkers(markers);
      renderFn();
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

    return () => {
      if (cluster) map.off("moveend", renderFn);
    };
  }, [markers, route, selectedId, onMarkerClick, cluster]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
    </div>
  );
}
