import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/geo";
import type { ChargingStation } from "@/types/database";

const FAST_CHARGER_MIN_KW = 100;
const NEARBY_RADIUS_KM = 50;

export interface NearbyChargingStation extends ChargingStation {
  distanceKm: number;
}

/**
 * Laedt alle Ladepunkte und berechnet die Distanz zum gegebenen Standort.
 * Fuer den MVP-Datenumfang (wenige hundert Eintraege) reicht ein einfacher
 * Haversine-Vergleich in JS -- bei groesserem Datenbestand sollte dies durch
 * eine PostGIS-Bounding-Box-Abfrage ersetzt werden.
 */
export async function fetchNearbyChargingStations(
  center: { latitude: number; longitude: number },
  radiusKm = NEARBY_RADIUS_KM
): Promise<NearbyChargingStation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("charging_stations").select("*");
  if (error) throw new Error(error.message);

  return ((data as ChargingStation[]) ?? [])
    .map((station) => ({ ...station, distanceKm: distanceKm(center, station) }))
    .filter((station) => station.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function nearestFastChargerDistanceKm(stations: NearbyChargingStation[]): number | null {
  const fastChargers = stations.filter((s) => (s.power_kw ?? 0) >= FAST_CHARGER_MIN_KW);
  if (fastChargers.length === 0) return null;
  return Math.min(...fastChargers.map((s) => s.distanceKm));
}
