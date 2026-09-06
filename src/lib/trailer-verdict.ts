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

export const TRAILER_VERDICT_COLORS: Record<TrailerVerdict, string> = {
  yes: "#059669",
  unhitch: "#d97706",
  no: "#dc2626",
  unknown: "#6b7280",
};
