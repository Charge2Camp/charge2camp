import type { RouteRequest, RouteResult, RoutingProvider } from "./types";

/**
 * OSRM-Adapter (§24). Nutzt den oeffentlichen Demo-Server von OSRM
 * (router.project-osrm.org) -- kostenlos, kein API-Key, aber laut OSRM nur
 * fuer Evaluierung/geringen Traffic gedacht (siehe docs/data-sources.md).
 * Fuer Produktivbetrieb muss auf einen selbst gehosteten OSRM/Valhalla/
 * GraphHopper-Server umgestellt werden -- dafuer genuegt ein neuer Adapter,
 * der dasselbe RoutingProvider-Interface implementiert.
 */
const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

export const osrmProvider: RoutingProvider = {
  id: "osrm",
  async planRoute(request: RouteRequest): Promise<RouteResult> {
    const points = [request.start, ...(request.waypoints ?? []), request.end];
    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(";");
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const response = await fetch(url, {
      headers: { "User-Agent": "eCamper-dev/0.1 (MVP, lokale Entwicklung)" },
    });
    if (!response.ok) {
      throw new Error(`OSRM-Anfrage fehlgeschlagen (${response.status}).`);
    }

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new Error("Keine Route gefunden.");
    }

    const route = data.routes[0];
    const geometry: RouteResult["geometry"] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })
    );

    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry,
    };
  },
};
