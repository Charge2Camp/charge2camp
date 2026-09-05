export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteRequest {
  start: LatLng;
  end: LatLng;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Streckengeometrie als [lat, lon]-Punkte, in Fahrtrichtung sortiert. */
  geometry: LatLng[];
}

export interface RoutingProvider {
  id: string;
  planRoute(request: RouteRequest): Promise<RouteResult>;
}
