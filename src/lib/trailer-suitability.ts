import type { TrailerSuitability } from "@/types/database";

export const TRAILER_SUITABILITY_VALUES: TrailerSuitability[] = [
  "confirmed",
  "likely",
  "unknown",
  "unsuitable",
];

export const TRAILER_SUITABILITY_LABELS: Record<TrailerSuitability, string> = {
  confirmed: "Bestätigt anhängertauglich",
  likely: "Vermutlich anhängertauglich",
  unknown: "Unbekannt",
  unsuitable: "Nicht anhängertauglich",
};

export const TRAILER_SUITABILITY_COLORS: Record<TrailerSuitability, string> = {
  confirmed: "#059669", // grün
  likely: "#84cc16", // hellgrün
  unknown: "#9ca3af", // grau
  unsuitable: "#dc2626", // rot
};
