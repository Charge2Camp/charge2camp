import type { LatLng } from "@/lib/providers/routing/types";
import { distanceKm } from "@/lib/geo";

/**
 * Grobe Bounding-Box je Land -- kein echtes Grenzpolygon (das wuerde einen
 * zusaetzlichen Datensatz + Abhaengigkeit erfordern), sondern eine bewusste
 * MVP-Naeherung ohne jede Netzwerkanfrage: schnell, kostenlos, kein
 * Timeout-Risiko (siehe Bugreport "Gateway Timeout" bei zu vielen parallelen
 * Anfragen -- eine Grenzermittlung per Reverse-Geocoding je Streckenpunkt
 * haette dasselbe Risiko erneut eingefuehrt). Bewusst von der kleinsten zur
 * groessten Flaeche sortiert: ueberlappende Nachbarn (z. B. Oesterreich
 * umschliesst Teile der Schweiz-Box) werden dadurch zuerst dem kleineren,
 * spezifischeren Land zugeordnet.
 */
interface CountryBoundingBox {
  code: string;
  west: number;
  south: number;
  east: number;
  north: number;
}

const COUNTRY_BOUNDING_BOXES: CountryBoundingBox[] = [
  { code: "LU", west: 5.7, south: 49.4, east: 6.6, north: 50.2 },
  { code: "CH", west: 5.9, south: 45.8, east: 10.5, north: 47.9 },
  { code: "SI", west: 13.3, south: 45.4, east: 16.6, north: 46.9 },
  { code: "NL", west: 3.3, south: 50.7, east: 7.3, north: 53.6 },
  { code: "BE", west: 2.5, south: 49.4, east: 6.4, north: 51.6 },
  { code: "DK", west: 8.0, south: 54.5, east: 15.3, north: 57.8 },
  { code: "CZ", west: 12.0, south: 48.5, east: 18.9, north: 51.1 },
  { code: "SK", west: 16.8, south: 47.7, east: 22.6, north: 49.7 },
  { code: "HU", west: 16.0, south: 45.7, east: 22.9, north: 48.6 },
  { code: "HR", west: 13.4, south: 42.3, east: 19.5, north: 46.6 },
  { code: "IE", west: -10.7, south: 51.4, east: -5.9, north: 55.4 },
  { code: "PT", west: -9.6, south: 36.9, east: -6.1, north: 42.2 },
  { code: "AT", west: 9.5, south: 46.4, east: 17.2, north: 49.0 },
  { code: "GB", west: -8.7, south: 49.8, east: 1.8, north: 60.9 },
  { code: "DE", west: 5.8, south: 47.2, east: 15.1, north: 55.1 },
  { code: "IT", west: 6.6, south: 35.4, east: 18.6, north: 47.1 },
  { code: "ES", west: -9.4, south: 35.9, east: 4.4, north: 43.9 },
  { code: "FR", west: -5.2, south: 41.3, east: 9.7, north: 51.2 },
  { code: "PL", west: 14.0, south: 49.0, east: 24.2, north: 55.0 },
  { code: "SE", west: 10.9, south: 55.3, east: 24.2, north: 69.1 },
  { code: "NO", west: 4.5, south: 57.9, east: 31.3, north: 71.2 },
  { code: "FI", west: 20.5, south: 59.7, east: 31.6, north: 70.1 },
];

export function countryCodeForPoint(point: LatLng): string | null {
  const match = COUNTRY_BOUNDING_BOXES.find(
    (box) =>
      point.longitude >= box.west &&
      point.longitude <= box.east &&
      point.latitude >= box.south &&
      point.latitude <= box.north
  );
  return match?.code ?? null;
}

/**
 * Erlaubte Hoechstgeschwindigkeit fuer PKW mit Wohnwagengespann je Land
 * (ueberwiegend der Wert fuer Autobahn/Schnellstrasse, der fuer laengere
 * Reiserouten massgeblich ist) -- oeffentlich bekannte Verkehrsregeln, keine
 * Rechtsberatung. Laender ohne Eintrag nutzen DEFAULT_TRAILER_SPEED_LIMIT_KMH.
 */
export const TRAILER_SPEED_LIMIT_KMH: Record<string, number> = {
  DE: 100,
  AT: 100,
  CH: 80,
  IT: 80,
  FR: 90,
  NL: 90,
  BE: 90,
  LU: 90,
  ES: 90,
  PT: 100,
  PL: 80,
  CZ: 80,
  SK: 80,
  HU: 80,
  SI: 100,
  HR: 80,
  DK: 80,
  SE: 80,
  NO: 80,
  FI: 80,
  GB: 96,
  IE: 80,
};

export const DEFAULT_TRAILER_SPEED_LIMIT_KMH = 80;

/**
 * Sicherheitsabschlag auf die erlaubte Hoechstgeschwindigkeit (Nutzerwunsch):
 * lieber eine etwas laengere Reisezeit anzeigen, damit es sich fuer den
 * Nutzer positiv anfuehlt, wenn die Fahrt tatsaechlich schneller geht, statt
 * eine zu knapp kalkulierte Zeit zu unterschreiten.
 */
export const TRAILER_SPEED_SAFETY_FACTOR = 0.9;

export function effectiveTrailerSpeedKmh(countryCode: string | null): number {
  const limit = countryCode ? TRAILER_SPEED_LIMIT_KMH[countryCode] : undefined;
  return (limit ?? DEFAULT_TRAILER_SPEED_LIMIT_KMH) * TRAILER_SPEED_SAFETY_FACTOR;
}

/**
 * Reisezeit (Minuten) einer Route: laeuft die Geometrie Punkt fuer Punkt ab
 * und summiert je Teilstueck die Zeit beim Anhaenger-Tempolimit des Landes
 * am Mittelpunkt dieses Teilstuecks (siehe effectiveTrailerSpeedKmh) --
 * ersetzt die von OSRM gelieferte Fahrzeit, die von einem PKW ohne Anhaenger
 * und ohne Sicherheitsabschlag ausgeht (Nutzerwunsch: "Reisezeit" statt
 * "Fahrzeit").
 */
export function estimateTravelTimeMin(geometry: LatLng[]): number {
  let totalMin = 0;
  for (let i = 1; i < geometry.length; i++) {
    const segmentKm = distanceKm(geometry[i - 1], geometry[i]);
    if (segmentKm <= 0) continue;
    const midpoint: LatLng = {
      latitude: (geometry[i - 1].latitude + geometry[i].latitude) / 2,
      longitude: (geometry[i - 1].longitude + geometry[i].longitude) / 2,
    };
    const speedKmh = effectiveTrailerSpeedKmh(countryCodeForPoint(midpoint));
    totalMin += (segmentKm / speedKmh) * 60;
  }
  return totalMin;
}
