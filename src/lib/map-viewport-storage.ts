export interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

/** Zuletzt gezeigter Kartenausschnitt (Mittelpunkt + Zoom) einer Karten-
 * Explorer-Seite (Ladepunkte/Campingplaetze) -- wird bei jedem Schwenken/
 * Zoomen ueberschrieben und beim naechsten Mount gelesen (z. B. nach
 * "Zurueck" von einer Detailseite oder beim Wechsel Liste -> Karte).
 * Nutzerwunsch: nach dem Zurueckkehren soll exakt derselbe Ausschnitt
 * wieder da sein, nicht die Zuhause-Adresse/ein neu berechnetes fitBounds. */
export function loadSavedMapViewport(storageKey: string): MapViewport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as MapViewport;
  } catch {
    return null;
  }
}

export function saveMapViewport(storageKey: string, viewport: MapViewport) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(viewport));
  } catch {
    // sessionStorage nicht verfuegbar -- Ausschnitt wird dann beim naechsten
    // Mount einfach nicht wiederhergestellt, kein Fehler noetig.
  }
}
