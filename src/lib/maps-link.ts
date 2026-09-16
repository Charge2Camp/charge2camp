import { geocodeAddress, reverseGeocode } from "@/lib/providers/geocoding/nominatim";

export interface ExtractedCoordinates {
  latitude: number;
  longitude: number;
}

/** Ergebnis der Link-Auswertung fuer die Meldung einer fehlenden
 * Ladestation. `name` ist nur ein Hinweis (siehe extractPlaceNameHint) --
 * ob das der Stationsname oder eher der Betreiber ist, kann aus der URL
 * allein nicht sicher unterschieden werden, deshalb wird es im Admin-Review
 * nur als Vorschlag angezeigt, nie automatisch in ein bestimmtes Feld
 * uebernommen. street/postcode/city/countryCode kommen aus Reverse-
 * Geocoding (eigene OSM-Daten), strukturiert statt als ein Textblock, damit
 * sie sich auf die getrennten Formularfelder verteilen lassen. */
export interface ExtractedStationCandidate {
  latitude: number;
  longitude: number;
  name: string | null;
  street: string | null;
  postcode: string | null;
  city: string | null;
  countryCode: string | null;
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

/** Ladestations-Namen aus dem URL-PFAD selbst lesen (".../maps/place/Allego+
 * Charging+Station/@..." -- der Name steht dort als vom "Teilen"-Button
 * eingebetteter URL-Text, nicht als gerenderter Seiteninhalt). Kein
 * Netzwerkzugriff, rein String-Verarbeitung. */
function extractPlaceNameHint(url: string): string | null {
  const match = url.match(/\/maps\/place\/([^/?]+)/);
  if (!match) return null;
  const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
  return name || null;
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

interface SuggestedAddress {
  street: string | null;
  postcode: string | null;
  city: string | null;
  countryCode: string | null;
}

const EMPTY_ADDRESS: SuggestedAddress = { street: null, postcode: null, city: null, countryCode: null };

/** Adresse zu bereits bekannten Koordinaten per Reverse-Geocoding vorschlagen
 * (eigene OSM-Daten via Nominatim, kein Google-Zugriff) -- liefert bei
 * jedem Fehler leere Felder statt zu werfen, ein Scheitern hier darf die
 * Meldung nicht blockieren. */
async function suggestAddress(latitude: number, longitude: number): Promise<SuggestedAddress> {
  try {
    const result = await reverseGeocode(latitude, longitude);
    if (!result) return EMPTY_ADDRESS;
    return { street: result.street, postcode: result.postcode, city: result.city, countryCode: result.countryCode };
  } catch {
    return EMPTY_ADDRESS;
  }
}

/** Loest einen (ggf. verkuerzten, z.B. maps.app.goo.gl) Google-Maps-Link per
 * HTTP-Redirect-Verfolgung auf und liest NUR die finale URL (response.url)
 * -- niemals response.text()/response.json() (das waere das Lesen von
 * Googles gerendertem Seiteninhalt). Koordinaten/Name kommen ausschliesslich
 * aus dem URL-Muster selbst, die Adresse aus eigenem Reverse-Geocoding.
 * Siehe docs/data-sources.md ("Ausdruecklich NICHT als Quelle verwendet") --
 * dies ist eine bewusst schmalere, dokumentierte Ausnahme (nur URL-Struktur
 * eines vom Nutzer selbst geteilten Links plus eigener Geocoder), kein
 * Scraping von Google-Maps-Inhalten. Steckertyp/Leistung/Anzahl lassen sich
 * aus keiner Maps-URL ableiten und bleiben bewusst Admin-Handarbeit.
 *
 * Darf eine Nutzer-Meldung NIEMALS blockieren: jeder Fehler (ungueltige URL,
 * Timeout, Netzwerkfehler, unbekanntes Format) liefert null statt zu werfen
 * -- siehe reportMissingStation() in src/app/profil/actions.ts. */
export async function extractStationCandidateFromMapsLink(rawUrl: string): Promise<ExtractedStationCandidate | null> {
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

    const nameHint = extractPlaceNameHint(finalUrl);

    const fromUrlStructure = parseCoordinatesFromUrl(finalUrl);
    if (fromUrlStructure) {
      const address = await suggestAddress(fromUrlStructure.latitude, fromUrlStructure.longitude);
      return { ...fromUrlStructure, name: nameHint, ...address };
    }

    // Fallback: kein @lat,lon/!3d!4d-Muster gefunden -- Adresse aus dem
    // q-Parameter ueber den eigenen Geocoder aufloesen statt aufzugeben.
    // geocodeAddress() wirft bei einer fehlgeschlagenen Anfrage, deshalb im
    // selben try/catch -- ein Geocoding-Fehler darf die Meldung ebenso wenig
    // blockieren wie ein Aufloese-Fehler oben.
    const addressQuery = extractAddressQueryParam(finalUrl);
    if (!addressQuery) return null;

    // q ist typischerweise "Name, Strasse Hausnummer, PLZ Ort" -- das erste
    // Komma-Segment ist der vermutete Name (Namens-Hinweis). Nominatims
    // strukturierte Suche findet mit dem vollen String (inkl. Name) oft
    // nichts (Praxistest: "Allego Charging Station, Messerschmittstraße 10,
    // 86453 Dasing" -> 0 Treffer, ohne den Namen sofort ein Treffer) --
    // deshalb zuerst der volle String, dann ohne das erste Segment.
    const [firstSegment, ...rest] = addressQuery.split(",");
    const addressOnly = rest.join(",").trim();
    const queryNameHint = nameHint ?? (rest.length > 0 ? firstSegment.trim() : null);

    const geocoded = (await geocodeAddress(addressQuery)) ?? (addressOnly ? await geocodeAddress(addressOnly) : null);
    if (!geocoded) return null;

    const address = await suggestAddress(geocoded.latitude, geocoded.longitude);
    return { latitude: geocoded.latitude, longitude: geocoded.longitude, name: queryNameHint, ...address };
  } catch {
    return null;
  }
}
