export interface NavigationPoint {
  latitude: number;
  longitude: number;
}

export interface NavigationRouteRequest {
  origin: NavigationPoint;
  destination: NavigationPoint;
  /** Zwischenstopps (z. B. Ladestopps) in Fahrtreihenfolge. */
  stops: NavigationPoint[];
}

/**
 * Adapter fuer externe Navigations-Apps (§14-Prinzip: Provider kapseln,
 * nie fest verdrahten). Baut NUR eine URL/einen Deep-Link -- oeffnet ihn
 * bewusst NICHT selbst (kein `window.open` o.ae. hier), damit dieselbe
 * Adapter-Logik spaeter unveraendert in einer nativen iOS/Android-App
 * wiederverwendet werden kann (dort uebernimmt z. B. React Natives
 * `Linking.openURL` das Oeffnen statt `window.open` im Web).
 */
export interface NavigationProvider {
  id: string;
  label: string;
  /** Maximale Anzahl an Zwischenstopps, die dieser Anbieter zuverlaessig unterstuetzt (UI-Hinweis, keine harte Grenze). */
  maxStops: number;
  buildUrl(request: NavigationRouteRequest): string;
}
