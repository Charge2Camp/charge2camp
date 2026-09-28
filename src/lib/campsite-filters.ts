import type { CampsiteFilters } from "@/lib/campsites";

/** Bewusst HIER (statt in campsites.ts) definiert: campsites.ts importiert
 * server-only Code (next/headers ueber lib/supabase/server), ein Wert-Import
 * von dort in "use client"-Code (campsite-search-client.tsx, quick-filters.tsx)
 * zieht sonst den kompletten Modulgraphen ins Client-Bundle -- gleiches
 * Muster/gleicher Grund wie in charging-station-filters.ts dokumentiert.
 * `CampsiteFilters` selbst ist ein reiner Typ-Import (wird beim Build
 * entfernt, unproblematisch). Betraf hier tatsaechlich einen Build-Fehler
 * ("next/headers" im Client-Bundle), als EV_SCORE_MIN_OPTIONS noch in
 * campsites.ts stand (Audit-Befund 2026-09-28) -- campsites.ts importiert
 * die Konstante seitdem umgekehrt von HIER. */

/** Stufen fuer den "Mindest-EV-Score"-Wheel-Picker (quick-filters.tsx) --
 * dieselbe Idee wie MIN_POWER_KW_OPTIONS beim Routenplaner/Ladepunkte-Filter:
 * grobe, verstaendliche Stufen statt eines Sliders mit 100 Einzelwerten. */
export const EV_SCORE_MIN_OPTIONS = [0, 50, 70, 90] as const;

/** Fuer die Zahl-Badge am "Weitere Filter"-Button -- zaehlt bewusst nur die
 * dort versteckten Filter (Suche + Merkmale ausser Elektromobilitaet/Land/
 * Lademoeglichkeit/EV-Score/Bewertung, die direkt auf der Seite stehen, s.
 * quick-filters.tsx). */
export function computeFurtherFilterCount(filters: CampsiteFilters, evAmenityKeys: Set<string>): number {
  return (filters.q ? 1 : 0) + filters.amenities.filter((key) => !evAmenityKeys.has(key)).length;
}

/** Baut die Query-Parameter aus einem vollstaendigen Filterzustand -- Basis
 * fuer die URL-Synchronisierung (Teilen-Links/Zurueck-Button/JS-loser
 * Fallback bleiben korrekt), siehe campsite-search-client.tsx. */
export function buildCampsiteFilterParams(filters: CampsiteFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.country) params.set("country", filters.country);
  if (filters.charging) params.set("charging", filters.charging);
  if (filters.evScoreMin) params.set("evScoreMin", String(filters.evScoreMin));
  if (filters.ratingMin) params.set("ratingMin", String(filters.ratingMin));
  for (const key of filters.amenities) params.set(key, "1");
  return params;
}
