import type { TrailerVerdict } from "@/types/database";

/** Labels/Farben fuer enrich.trailer_suitability.verdict (echte Daten,
 * core.charge_point) -- bewusst getrennt von TRAILER_SUITABILITY_* in
 * trailer-suitability.ts, das weiterhin fuer den Routenplaner-Demo-Korridor
 * (public.charging_stations) gilt. Vierstufig statt boolesch: 'unhitch'
 * (nur abgekoppelt erreichbar) ist der haeufigste reale Fall. */
export const TRAILER_VERDICT_VALUES: TrailerVerdict[] = ["yes", "unhitch", "no", "unknown"];

export const TRAILER_VERDICT_LABELS: Record<TrailerVerdict, string> = {
  yes: "Anhängertauglich bestätigt",
  unhitch: "Nur abgekoppelt erreichbar",
  no: "Nicht anhängertauglich",
  unknown: "Noch nicht bewertet",
};

// Farben aus docs/design/brand-guide.md Abschnitt 7 ("Fuenf Zustaende,
// jeweils eigene Farbe und eigenes Zeichen") -- hier auf die vier
// vorhandenen Rohzustaende gemappt: yes = route (--c-route, entspricht
// "ohne Abkoppeln"/"Drive-Through" je nach drive_through-Flag, siehe
// enrich.trailer_suitability), unhitch = status-busy (--c-status-busy,
// "bedingt tauglich"), no = status-down (--c-status-down, "nicht
// tauglich"), unknown = status-unknown (--c-status-unknown, "ungeprueft").
export const TRAILER_VERDICT_COLORS: Record<TrailerVerdict, string> = {
  yes: "#1D9E75",
  unhitch: "#E8A33D",
  no: "#B4443A",
  unknown: "#8E9A94",
};
