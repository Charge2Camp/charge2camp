import type { LatLng } from "@/lib/providers/routing/types";

/**
 * Geocoding ueber die oeffentliche Nominatim-API (OpenStreetMap) --
 * kostenlos, kein API-Key. Nutzungsrichtlinie verlangt max. 1 Anfrage/s und
 * einen aussagekraeftigen User-Agent (siehe docs/data-sources.md). Fuer
 * hoeheres Produktions-Volumen muesste auf einen selbst gehosteten
 * Nominatim-Server oder einen kommerziellen Geocoder umgestellt werden.
 */
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

export interface GeocodeResult extends LatLng {
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Charge2Camp-dev/0.1 (MVP, lokale Entwicklung)" },
  });
  if (!response.ok) {
    throw new Error(`Geocoding-Anfrage fehlgeschlagen (${response.status}).`);
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const first = results[0];
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    displayName: first.display_name,
  };
}

export interface ReverseGeocodeResult {
  displayName: string;
  /** Strasse + Hausnummer, z.B. "Messerschmittstraße 10" -- zusammengesetzt
   * aus Nominatims addressdetails, nicht aus displayName geparst (das waere
   * fragiler). Null, wenn Nominatim keine Strasse liefert. */
  street: string | null;
  postcode: string | null;
  city: string | null;
  countryCode: string | null;
}

/** Reverse-Geocoding (Koordinaten -> Adresse), gleicher Provider/gleiche
 * Nutzungsrichtlinie wie geocodeAddress(). Genutzt von src/lib/maps-link.ts,
 * um zu erkannten Koordinaten aus einem gemeldeten Google-Maps-Link
 * zusaetzlich eine Adresse vorzuschlagen -- das sind ausschliesslich eigene
 * OSM-Daten, kein Zugriff auf Google. `addressdetails=1` liefert die Adresse
 * in Einzelfeldern statt nur als einen langen Textblock (Land/Bundesland/
 * Landkreis inklusive), damit sie sich auf die getrennten Formularfelder
 * (Adresse/PLZ/Stadt/Land) verteilen laesst statt alles in ein Feld zu
 * quetschen. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const url = `${NOMINATIM_BASE_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Charge2Camp-dev/0.1 (MVP, lokale Entwicklung)" },
  });
  if (!response.ok) {
    throw new Error(`Reverse-Geocoding-Anfrage fehlgeschlagen (${response.status}).`);
  }

  const result = await response.json();
  if (!result || typeof result.display_name !== "string") return null;

  const addr = result.address ?? {};
  const road = typeof addr.road === "string" ? addr.road : null;
  const houseNumber = typeof addr.house_number === "string" ? addr.house_number : null;
  const street = road ? [road, houseNumber].filter(Boolean).join(" ") : null;
  const city = typeof addr.city === "string" ? addr.city : typeof addr.town === "string" ? addr.town : typeof addr.village === "string" ? addr.village : null;

  return {
    displayName: result.display_name,
    street,
    postcode: typeof addr.postcode === "string" ? addr.postcode : null,
    city,
    countryCode: typeof addr.country_code === "string" ? addr.country_code.toUpperCase() : null,
  };
}
