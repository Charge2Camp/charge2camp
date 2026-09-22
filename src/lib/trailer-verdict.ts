import type { TrailerSuitabilityRecord, TrailerVerdict } from "@/types/database";

/** Labels/Farben fuer enrich.trailer_suitability.verdict (core.charge_point).
 * Vierstufig statt boolesch: 'unhitch' (nur abgekoppelt erreichbar) ist der
 * haeufigste reale Fall. */
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

/** Die fuenf Kartenpin-Zustaende aus docs/design/brand-guide.md Abschnitt
 * 7 -- eine Skala von schlecht nach ideal. `yes` teilt sich abhaengig vom
 * `drive_through`-Flag (enrich.trailer_suitability, bereits im Schema
 * vorhanden) in zwei Pins auf: "ohne Abkoppeln" (Stellplatz vorhanden,
 * muss aber rangiert werden) vs. "Drive-Through" (durchfahren, kein
 * Rangieren noetig) -- der beste Fall. */
export type TrailerPinState = "nicht_tauglich" | "bedingt_tauglich" | "ohne_abkoppeln" | "drive_through" | "ungeprueft";

export function getTrailerPinState(
  trailer: Pick<TrailerSuitabilityRecord, "verdict" | "drive_through"> | null | undefined
): TrailerPinState {
  const verdict = trailer?.verdict ?? "unknown";
  if (verdict === "no") return "nicht_tauglich";
  if (verdict === "unhitch") return "bedingt_tauglich";
  if (verdict === "yes") return trailer?.drive_through ? "drive_through" : "ohne_abkoppeln";
  return "ungeprueft";
}

export const TRAILER_PIN_LABELS: Record<TrailerPinState, string> = {
  nicht_tauglich: "Nicht anhängertauglich",
  bedingt_tauglich: "Vermutlich abkoppeln nötig",
  ohne_abkoppeln: "Laden ohne Abkoppeln",
  drive_through: "Drive-Through-Laden",
  ungeprueft: "Ungeprüft",
};

export const TRAILER_PIN_COLORS: Record<TrailerPinState, string> = {
  nicht_tauglich: "#B4443A",
  bedingt_tauglich: "#E8A33D",
  ohne_abkoppeln: "#1D9E75",
  drive_through: "#C6F24E",
  ungeprueft: "#8E9A94",
};

export const TRAILER_PIN_ICON_SRC: Record<TrailerPinState, string> = {
  nicht_tauglich: "/pins/pin-nicht-tauglich.svg",
  bedingt_tauglich: "/pins/pin-bedingt-tauglich.svg",
  ohne_abkoppeln: "/pins/pin-ohne-abkoppeln.svg",
  drive_through: "/pins/pin-drive-through.svg",
  ungeprueft: "/pins/pin-ungeprueft.svg",
};

/** Zusaetzlich zur Anhaengertauglichkeit (oben: PASST das Gespann rein?)
 * eine zweite, unabhaengige Achse: WIE VERTRAUENSWUERDIG ist die Angabe?
 * enrich.trailer_suitability.origin verraet die Herkunft:
 * - kein Eintrag                      -> noch nie irgendwer hat sich dazu
 *                                        geaeussert
 * - origin='community'                -> aus der Melde-/Moderations-
 *                                        Warteschlange (enrich.trailer_report
 *                                        + moderate_trailer_report()) --
 *                                        ein Admin hat die Meldung nur
 *                                        durchgewunken, nicht selbst
 *                                        geprueft
 * - origin='admin_override'           -> ein Admin hat die Angabe im
 *                                        Backend direkt selbst erfasst/
 *                                        korrigiert (siehe admin/app/
 *                                        (dashboard)/ladestationen/[id]/
 *                                        actions.ts, overrideTrailerSuitability)
 * - origin='auto'                     -> algorithmisch erzeugter
 *                                        Platzhalter (verdict dabei fast
 *                                        immer 'unknown') aus dem initialen
 *                                        Datenimport, KEINE echte Bewertung
 *                                        -- zaehlt wie "kein Eintrag"
 * - jede andere Quelle (sascha_list/operator/staff aus dem initialen
 *   Datenimport) zaehlt ebenfalls als "geprueft" -- das sind keine
 *   ungeprueften Nutzerangaben, sondern kuratierte Quellen. */
export type ReviewState = "not_reviewed" | "community" | "verified";

export function getReviewState(origin: string | null | undefined): ReviewState {
  if (!origin || origin === "auto") return "not_reviewed";
  if (origin === "community") return "community";
  return "verified";
}

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  not_reviewed: "Noch nicht bewertet",
  community: "Community geprüft",
  verified: "Geprüft",
};

export const REVIEW_STATE_COLORS: Record<ReviewState, string> = {
  not_reviewed: "#8E9A94",
  community: "#E8A33D",
  verified: "#1D9E75",
};

/** Kartenpin fuer Campingplatz-Standorte (docs/design/brand-guide.md
 * Abschnitt 7 erweitert um einen sechsten, CI-konformen Zustand) -- dunkles
 * Basisgruen mit Zelt-Glyph, bewusst ausserhalb der Anhaengertauglichkeits-
 * Farbskala (rot/orange/gruen/lime/grau), damit Campingplatz-Standorte auf
 * derselben Karte klar von Ladepunkt-Pins unterscheidbar bleiben. */
export const CAMPSITE_PIN_ICON_SRC = "/pins/pin-campingplatz.svg";
