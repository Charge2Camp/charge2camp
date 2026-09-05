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
