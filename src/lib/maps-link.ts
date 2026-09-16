import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";

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

/** Manche Google-Maps-Kurzlinks (je nachdem, ueber welchen "Teilen"-Button
 * sie erzeugt wurden) loesen NICHT zu einer URL mit eingebetteten
 * Koordinaten auf, sondern zu einer Such-URL der Form
 * ".../maps?q=Name,+Strasse+Hausnummer,+PLZ+Ort&ftid=...". Der `q`-Parameter
 * ist reiner URL-Text (kein Google-Seiteninhalt) und kann als Adresse an
 * einen eigenen Geocoder (Nominatim, bereits fuer die Routenplanung im
 * Einsatz) uebergeben werden, um doch noch Koordinaten zu erhalten. */
function extractAddressQueryParam(url: string): string | null {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q");
    return q && q.trim() ? q.trim() : null;
  } catch {
    return null;
  }
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
    const finalUrl = decodeURIComponent(response.url || rawUrl);

    const fromUrlStructure = parseCoordinatesFromUrl(finalUrl);
    if (fromUrlStructure) return fromUrlStructure;

    // Fallback: kein @lat,lon/!3d!4d-Muster gefunden (siehe
    // extractAddressQueryParam) -- Adresse aus dem q-Parameter ueber den
    // eigenen Geocoder aufloesen statt aufzugeben. geocodeAddress() wirft
    // bei einer fehlgeschlagenen Anfrage, deshalb im selben try/catch --
    // ein Geocoding-Fehler darf die Meldung ebenso wenig blockieren wie ein
    // Aufloese-Fehler oben.
    const addressQuery = extractAddressQueryParam(finalUrl);
    if (!addressQuery) return null;

    const geocoded = await geocodeAddress(addressQuery);
    if (geocoded) return { latitude: geocoded.latitude, longitude: geocoded.longitude };

    // q ist typischerweise "Name, Strasse Hausnummer, PLZ Ort" -- Nominatims
    // strukturierte Suche findet damit oft nichts (Praxistest: "Allego
    // Charging Station, Messerschmittstraße 10, 86453 Dasing" -> 0
    // Treffer), weil der fuehrende Name kein Adressbestandteil ist. Zweiter
    // Versuch ohne das erste Komma-Segment (den vermuteten Namen).
    const withoutFirstSegment = addressQuery.split(",").slice(1).join(",").trim();
    if (!withoutFirstSegment) return null;
    const geocodedWithoutName = await geocodeAddress(withoutFirstSegment);
    return geocodedWithoutName ? { latitude: geocodedWithoutName.latitude, longitude: geocodedWithoutName.longitude } : null;
  } catch {
    return null;
  }
}
