import type { Caravan, Vehicle } from "@/types/database";

export interface GespannDimensions {
  /** Massgebliche Gespannhoehe (m) -- das groessere Mass aus Fahrzeug/
   * Wohnwagen, da eine Hoehenbeschraenkung das gesamte Gespann betrifft. */
  heightM: number | null;
  /** Massgebliche Gespannbreite (m), analog zu heightM. */
  widthM: number | null;
  /** Gesamtgewicht (kg) aus Fahrzeug + Wohnwagen -- nur gesetzt, wenn BEIDE
   * Werte bekannt sind (eine Teilsumme waere als "Gespanngewicht"
   * irrefuehrend, siehe keine-Scheindaten-Prinzip). */
  weightKg: number | null;
}

/** Kombiniert Fahrzeug- und Wohnwagen-Abmessungen zu den Massen des
 * tatsaechlichen Gespanns, fuer den Strassenrestriktions-Check (§ Phase 7)
 * gegen OSM-Daten (siehe src/lib/providers/road-restrictions/). Liefert
 * `null` fuer ein Mass, sobald keine ausreichende Datengrundlage vorliegt --
 * niemals einen geschaetzten Platzhalterwert. */
export function combineGespannDimensions(
  vehicle: Pick<Vehicle, "width_m" | "height_m" | "weight_kg">,
  caravan: Pick<Caravan, "width_m" | "height_m" | "weight_kg" | "actual_travel_weight_kg"> | null
): GespannDimensions {
  const heights = [vehicle.height_m, caravan?.height_m].filter((v): v is number => v != null);
  const widths = [vehicle.width_m, caravan?.width_m].filter((v): v is number => v != null);

  const caravanWeight = caravan ? (caravan.actual_travel_weight_kg ?? caravan.weight_kg) : null;

  return {
    heightM: heights.length > 0 ? Math.max(...heights) : null,
    widthM: widths.length > 0 ? Math.max(...widths) : null,
    weightKg: vehicle.weight_kg != null && caravanWeight != null ? vehicle.weight_kg + caravanWeight : null,
  };
}
