import type { NavigationPoint, NavigationProvider, NavigationRouteRequest } from "./types";

function formatPoint(point: NavigationPoint): string {
  return `${point.latitude},${point.longitude}`;
}

/**
 * Google Maps "Directions"-URL-Schema (https://developers.google.com/maps/documentation/urls/get-started).
 * Funktioniert kostenlos ohne API-Key, oeffnet auf dem Handy automatisch die
 * installierte Google-Maps-App (sonst die Web-Version). Die Web-Oberflaeche
 * unterstuetzt bis zu 9 Zwischenstopps zuverlaessig -- mehr werden von Google
 * ggf. stillschweigend ignoriert, siehe `maxStops`.
 */
export const googleMapsNavigationProvider: NavigationProvider = {
  id: "google-maps",
  label: "Google Maps",
  maxStops: 9,
  buildUrl({ origin, destination, stops }: NavigationRouteRequest): string {
    const params = new URLSearchParams({
      api: "1",
      origin: formatPoint(origin),
      destination: formatPoint(destination),
      travelmode: "driving",
    });
    if (stops.length > 0) {
      params.set("waypoints", stops.map(formatPoint).join("|"));
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  },
};
