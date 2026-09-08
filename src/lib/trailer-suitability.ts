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

// Farben aus docs/design/brand-guide.md Abschnitt 7 (siehe auch
// trailer-verdict.ts fuer dieselbe Zuordnung bei den core.*-Ladepunkten).
export const TRAILER_SUITABILITY_COLORS: Record<TrailerSuitability, string> = {
  confirmed: "#1D9E75", // route
  likely: "#C6F24E", // action (naeher an "Drive-Through"/besserer Fall als status-busy)
  unknown: "#8E9A94", // status-unknown
  unsuitable: "#B4443A", // status-down
};

// Kartenpin-SVGs aus docs/design/brand-guide.md Abschnitt 7 (siehe auch
// trailer-verdict.ts fuer dieselbe Zuordnung bei den core.*-Ladepunkten).
// Der Demo-Korridor kennt kein "bedingt tauglich" (eng/Rangieren) --
// "likely" faellt daher auf den Drive-Through-Pin (bester Fall, passt zur
// obigen Lime-Einordnung), nicht auf den Rangier-Pin.
export const TRAILER_SUITABILITY_ICON_SRC: Record<TrailerSuitability, string> = {
  confirmed: "/pins/pin-ohne-abkoppeln.svg",
  likely: "/pins/pin-drive-through.svg",
  unknown: "/pins/pin-ungeprueft.svg",
  unsuitable: "/pins/pin-nicht-tauglich.svg",
};
