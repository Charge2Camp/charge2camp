import type { LatLng } from "@/lib/providers/routing/types";
import type { RoadRestrictionHit, RoadRestrictionProvider } from "./types";

/**
 * Strassenrestriktions-Adapter gegen die oeffentliche Overpass-API
 * (overpass-api.de, OpenStreetMap-Rohdaten) -- kostenlos, kein API-Key.
 * Findet Wege im Streckenkorridor, die eine Hoehen-/Breiten-/Gewichts-
 * beschraenkung (maxheight/maxwidth/maxweight-Tags) tragen, die das Gespann
 * ueberschreitet.
 *
 * Bewusst NUR eine Warnung, KEINE automatische Umfahrung: Der oeffentliche
 * OSRM-Demo-Server (siehe ../routing/osrm.ts) unterstuetzt keine
 * gespannspezifischen Routing-Profile, ein Selbst-Hosting mit
 * Gewichts-/Hoehenprofil ist fuer den MVP zu aufwaendig (§4
 * Kostenoptimierung). OSM-Tag-Abdeckung ist zudem lueckenhaft: eine
 * fehlende Warnung bedeutet NICHT "keine Beschraenkung vorhanden", nur
 * "keine bekannt" (§2 keine Scheindaten) -- siehe docs/architecture.md.
 */
const OVERPASS_URL = process.env.OVERPASS_BASE_URL ?? "https://overpass-api.de/api/interpreter";

// Overpass-Anfragen werden bewusst auf eine begrenzte Anzahl Stichproben-
// punkte entlang der Route reduziert (statt jeden Geometriepunkt zu
// verwenden) -- sonst waere die Anfrage bei langen Routen (mehrere hundert
// km, tausende Geometriepunkte) unverhaeltnismaessig gross fuer einen
// oeffentlichen, geteilten Dienst ohne SLA.
const MAX_SAMPLE_POINTS = 120;
const CORRIDOR_RADIUS_M = 25;

function sampleGeometry(geometry: LatLng[], maxSamples: number): LatLng[] {
  if (geometry.length <= maxSamples) return geometry;
  const step = (geometry.length - 1) / (maxSamples - 1);
  const samples: LatLng[] = [];
  for (let i = 0; i < maxSamples; i++) {
    samples.push(geometry[Math.round(i * step)]);
  }
  return samples;
}

/** Imperiale Notation (z. B. 11'6") wird bewusst nicht unterstuetzt -- in
 * Europa selten, das Risiko einer falschen Meter-Interpretation waere hoeher
 * als der Nutzen. */
function parseOsmLengthMeters(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.includes("'") || trimmed.includes('"')) return null;
  const match = trimmed.match(/^([\d.,]+)\s*m?$/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseOsmWeightTonnes(raw: string): number | null {
  const trimmed = raw.trim();
  const kgMatch = trimmed.match(/^([\d.,]+)\s*kg$/i);
  if (kgMatch) {
    const kg = Number(kgMatch[1].replace(",", "."));
    return Number.isFinite(kg) ? kg / 1000 : null;
  }
  const match = trimmed.match(/^([\d.,]+)\s*t?$/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

interface OverpassElement {
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export const overpassRoadRestrictionProvider: RoadRestrictionProvider = {
  id: "overpass",
  async checkRoute(geometry, dimensions) {
    if (dimensions.heightM === null && dimensions.widthM === null && dimensions.weightKg === null) {
      return [];
    }
    if (geometry.length === 0) return [];

    const points = sampleGeometry(geometry, MAX_SAMPLE_POINTS);
    const coordList = points.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join(",");
    const query = `[out:json][timeout:25];way(around:${CORRIDOR_RADIUS_M},${coordList})[~"^(maxheight|maxwidth|maxweight)$"~"."];out center;`;

    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Charge2Camp-dev/0.1 (MVP, lokale Entwicklung)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) {
      throw new Error(`Overpass-Anfrage fehlgeschlagen (${response.status}).`);
    }

    const data = (await response.json()) as { elements?: OverpassElement[] };
    const hits: RoadRestrictionHit[] = [];

    for (const element of data.elements ?? []) {
      if (!element.center || !element.tags) continue;
      const location: LatLng = { latitude: element.center.lat, longitude: element.center.lon };

      if (dimensions.heightM !== null && element.tags.maxheight) {
        const limit = parseOsmLengthMeters(element.tags.maxheight);
        if (limit !== null && limit < dimensions.heightM) {
          hits.push({ kind: "maxheight", limitValue: limit, location });
        }
      }
      if (dimensions.widthM !== null && element.tags.maxwidth) {
        const limit = parseOsmLengthMeters(element.tags.maxwidth);
        if (limit !== null && limit < dimensions.widthM) {
          hits.push({ kind: "maxwidth", limitValue: limit, location });
        }
      }
      if (dimensions.weightKg !== null && element.tags.maxweight) {
        const limitTonnes = parseOsmWeightTonnes(element.tags.maxweight);
        if (limitTonnes !== null && limitTonnes * 1000 < dimensions.weightKg) {
          hits.push({ kind: "maxweight", limitValue: limitTonnes, location });
        }
      }
    }

    return hits;
  },
};
