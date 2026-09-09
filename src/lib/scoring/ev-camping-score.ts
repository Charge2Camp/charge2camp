/**
 * Zentrale Gewichtung des EV-Camping-Scores (§11 der Spezifikation).
 * Regelbasiert, keine KI. Werte summieren sich auf 100 Punkte max.
 * Anpassungen an der Gewichtung geschehen ausschließlich hier.
 */
export const EV_SCORE_WEIGHTS = {
  onSite: 25, // Ladepunkt direkt auf dem Campingplatz
  power: 15, // Ladeleistung (max_charging_power_kw)
  pointCount: 10, // Anzahl Ladepunkte
  fastChargerProximity: 20, // Entfernung zum nächsten Schnelllader (>=100 kW)
  communityRating: 20, // Community-Bewertungen (rating_avg)
  dataFreshness: 10, // Aktualität der Daten (last_verified_at)
} as const;

// Ladepunkte AUF DEM CAMPINGPLATZ sind so gut wie nie DC-Schnelllader --
// realistisch ist dort AC-Laden mit 11-22 kW (Campingplatz-Stromkasten),
// mehr als 22 kW auf dem Platz selbst ist die Ausnahme. Ein Schwellwert von
// 150 kW (Schnelllader-Niveau) haette on-site-Lader also fast nie mit
// voller Punktzahl belohnt -- die volle Punktzahl gibt es jetzt schon ab
// 22 kW, alles darueber ist ein zusaetzlicher Bonus ohne Nachteil.
const FULL_POWER_KW = 22; // ab dieser Leistung gibt es die vollen Punkte
// Aus demselben Grund wie bei FULL_POWER_KW: 6 Ladepunkte auf einem
// Campingplatz sind die Ausnahme, nicht der Normalfall -- schon 2
// Ladepunkte auf dem Platz sind ein starkes Signal und verdienen die
// volle Punktzahl.
const FULL_POINT_COUNT = 2; // ab dieser Anzahl Ladepunkte gibt es die vollen Punkte

export interface EvScoreBreakdown {
  score: number; // 0-100, gerundet
  onSite: number;
  power: number;
  pointCount: number;
  fastChargerProximity: number;
  communityRating: number;
  dataFreshness: number;
  nearestFastChargerKm: number | null;
}

/** Campingplatz-Bewertungen fragen bewusst nur zwei EV-relevante Ja/Nein-
 * Fragen ab (kein freier Sterne-Picker, siehe review-form.tsx) -- der
 * gespeicherte `rating`-Wert (1-5, weiterhin genutzt vom bestehenden
 * communityRating-Faktor unten) wird daraus abgeleitet, statt direkt
 * erfragt zu werden: Laden auf dem Platz ist das staerkste Signal,
 * fussläufig nutzbares Laden das schwaechere Zusatzsignal, kein Laden
 * ueberhaupt das schlechteste. */
export function deriveCampsiteRating(chargingOnSite: boolean, chargingWalkable: boolean): number {
  if (chargingOnSite && chargingWalkable) return 5;
  if (chargingOnSite) return 4;
  if (chargingWalkable) return 3;
  return 1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Deckt sich bewusst mit FAST_CHARGER_RADIUS_KM (campingplaetze/[id]/
// page.tsx) -- ein Schnelllader innerhalb von 15 km ist mit dem Auto
// bequem erreichbar und zaehlt voll, weiter weg gibt es keine Punkte.
const FAST_CHARGER_FULL_RADIUS_KM = 15;

function fastChargerProximityFactor(km: number | null): number {
  if (km === null) return 0;
  return km <= FAST_CHARGER_FULL_RADIUS_KM ? 1 : 0;
}

function dataFreshnessFactor(lastVerifiedAt: string | null): number {
  if (!lastVerifiedAt) return 0;
  const ageDays = (Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.5;
  return 0;
}

// Stufen statt linearer Skalierung: ab 4,5 Sternen gibt es die volle
// Punktzahl, zwischen 3,5 und 4,5 (exklusiv) die Haelfte, darunter keine --
// ein einzelner mittelmaessiger Wert soll den Faktor nicht mehr fein
// proportional verwaessern, sondern klar zwischen "gut", "ok" und
// "schwach" unterscheiden.
function communityRatingFactor(ratingAvg: number | null): number {
  if (ratingAvg === null) return 0;
  if (ratingAvg >= 4.5) return 1;
  if (ratingAvg > 3.5) return 0.5;
  return 0;
}

/**
 * Berechnet den EV-Camping-Score fuer einen Campingplatz.
 * `nearestFastChargerKm` ist die Entfernung (km) zum naechsten bekannten
 * Schnelllader (>=100 kW) und muss vom Aufrufer ermittelt werden (siehe
 * src/lib/geo.ts), da dafuer die charging_stations-Tabelle abgefragt wird.
 */
export interface EvScoreInput {
  ev_charging_on_site: boolean;
  max_charging_power_kw: number | null;
  number_of_charging_points: number | null;
  rating_avg: number | null;
  last_verified_at: string | null;
}

export function calculateEvCampingScore(
  campsite: EvScoreInput,
  nearestFastChargerKm: number | null
): EvScoreBreakdown {
  const onSite = campsite.ev_charging_on_site ? EV_SCORE_WEIGHTS.onSite : 0;

  const power = campsite.ev_charging_on_site
    ? clamp01((campsite.max_charging_power_kw ?? 0) / FULL_POWER_KW) * EV_SCORE_WEIGHTS.power
    : 0;

  const pointCount = campsite.ev_charging_on_site
    ? clamp01((campsite.number_of_charging_points ?? 0) / FULL_POINT_COUNT) *
      EV_SCORE_WEIGHTS.pointCount
    : 0;

  const fastChargerProximity =
    fastChargerProximityFactor(nearestFastChargerKm) * EV_SCORE_WEIGHTS.fastChargerProximity;

  const communityRating = communityRatingFactor(campsite.rating_avg) * EV_SCORE_WEIGHTS.communityRating;

  const dataFreshness =
    dataFreshnessFactor(campsite.last_verified_at) * EV_SCORE_WEIGHTS.dataFreshness;

  const score = Math.round(
    onSite + power + pointCount + fastChargerProximity + communityRating + dataFreshness
  );

  return {
    score,
    onSite: Math.round(onSite),
    power: Math.round(power),
    pointCount: Math.round(pointCount),
    fastChargerProximity: Math.round(fastChargerProximity),
    communityRating: Math.round(communityRating),
    dataFreshness: Math.round(dataFreshness),
    nearestFastChargerKm,
  };
}
