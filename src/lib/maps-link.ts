export interface ExtractedCoordinates {
  latitude: number;
  longitude: number;
}

const FETCH_TIMEOUT_MS = 5000;

/** Rein (kein Netzwerkzugriff) -- separat exportiert, damit sie ohne
 * Netzwerk-Mock testbar ist. "!3d...!4d..." ist der exakte Marker-Punkt einer
 * Google-Maps-URL, praeziser als der Kartenausschnitt-Mittelpunkt
 * "@lat,lon,zoomz" und wird deshalb bevorzugt, falls beide Muster vorkommen. */
export function parseCoordinatesFromUrl(url: string): ExtractedCoordinates | null {
  const markerMatch = url.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  const atMatch = url.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  const match = markerMatch ?? atMatch;
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

/** Loest einen (ggf. verkuerzten, z.B. maps.app.goo.gl) Google-Maps-Link per
 * HTTP-Redirect-Verfolgung auf und liest NUR die finale URL (response.url)
 * -- niemals response.text()/response.json() (das waere das Lesen von
 * Googles gerendertem Seiteninhalt). Koordinaten kommen ausschliesslich aus
 * dem URL-Muster selbst. Siehe docs/data-sources.md ("Ausdruecklich NICHT
 * als Quelle verwendet") -- dies ist eine bewusst schmalere, dokumentierte
 * Ausnahme (nur Koordinaten aus der URL-Struktur eines vom Nutzer selbst
 * geteilten Links), kein Scraping von Google-Maps-Inhalten.
 *
 * Darf eine Nutzer-Meldung NIEMALS blockieren: jeder Fehler (ungueltige URL,
 * Timeout, Netzwerkfehler, unbekanntes Format) liefert null statt zu werfen
 * -- siehe reportMissingStation() in src/app/profil/actions.ts. */
export async function extractCoordinatesFromMapsLink(rawUrl: string): Promise<ExtractedCoordinates | null> {
  try {
    new URL(rawUrl);
  } catch {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(rawUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Charge2Camp-dev/0.1 (MVP, Link-Aufloesung)" },
    });
    clearTimeout(timer);
    return parseCoordinatesFromUrl(decodeURIComponent(response.url || rawUrl));
  } catch {
    return null;
  }
}
