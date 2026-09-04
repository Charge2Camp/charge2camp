import type { ChargingReview } from "@/types/database";

/**
 * Regelbasierte Auswertung der Community-Bewertungen eines Ladepunkts nach
 * Gespanngröße (§19) sowie eine optionale Einschätzung für das konkrete
 * Gespann des angemeldeten Nutzers (§20). Keine KI -- Schwellwerte hier
 * zentral und leicht anpassbar.
 */

const LARGE_TRAILER_THRESHOLD_M = 8.5;
const MIN_REVIEWS_FOR_SUMMARY = 3;
const MIN_REVIEWS_PER_BUCKET = 2;

function suitabilityWeight(suitable: ChargingReview["suitable"]): number {
  if (suitable === "yes") return 1;
  if (suitable === "limited") return 0.5;
  return 0; // "no"
}

function positiveRatio(reviews: ChargingReview[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + suitabilityWeight(r.suitable), 0);
  return sum / reviews.length;
}

export interface CommunitySuitabilitySummary {
  reviewCount: number;
  overallPositiveRatio: number | null;
  normalTrailerRatio: number | null;
  largeTrailerRatio: number | null;
  summary: string;
}

/**
 * Fasst alle Bewertungen eines Ladepunkts zu einer verständlichen Aussage
 * zusammen, z. B. "Geeignet für normale Gespanne, eingeschränkt für sehr
 * große Gespanne (> 8,5 m)." (Beispiel aus §19 der Spezifikation).
 */
export function summarizeCommunitySuitability(
  reviews: ChargingReview[]
): CommunitySuitabilitySummary {
  const normalReviews = reviews.filter(
    (r) => (r.trailer_length_m ?? 0) <= LARGE_TRAILER_THRESHOLD_M
  );
  const largeReviews = reviews.filter(
    (r) => (r.trailer_length_m ?? 0) > LARGE_TRAILER_THRESHOLD_M
  );

  const overallPositiveRatio = positiveRatio(reviews);
  const normalTrailerRatio = positiveRatio(normalReviews);
  const largeTrailerRatio = positiveRatio(largeReviews);

  let summary: string;

  if (reviews.length < MIN_REVIEWS_FOR_SUMMARY || overallPositiveRatio === null) {
    summary = "Noch nicht genug Bewertungen für eine verlässliche Einschätzung.";
  } else if (
    normalReviews.length >= MIN_REVIEWS_PER_BUCKET &&
    largeReviews.length >= MIN_REVIEWS_PER_BUCKET &&
    normalTrailerRatio !== null &&
    largeTrailerRatio !== null &&
    normalTrailerRatio - largeTrailerRatio >= 0.3
  ) {
    summary = `Geeignet für normale Gespanne, eingeschränkt für sehr große Gespanne (> ${LARGE_TRAILER_THRESHOLD_M.toString().replace(".", ",")} m).`;
  } else if (overallPositiveRatio >= 0.8) {
    summary = "Von der Community überwiegend als anhängertauglich bestätigt.";
  } else if (overallPositiveRatio >= 0.5) {
    summary = "Gemischte Rückmeldungen der Community.";
  } else {
    summary = "Von der Community überwiegend als nicht anhängertauglich gemeldet.";
  }

  return {
    reviewCount: reviews.length,
    overallPositiveRatio,
    normalTrailerRatio,
    largeTrailerRatio,
    summary,
  };
}

export type PersonalCompatibility = "sehr_gut" | "eingeschraenkt" | "unklar" | "keine_daten";

export const PERSONAL_COMPATIBILITY_LABELS: Record<PersonalCompatibility, string> = {
  sehr_gut: "Für dein Gespann: Sehr gut geeignet",
  eingeschraenkt: "Für dein Gespann: Eingeschränkt geeignet",
  unklar: "Für dein Gespann: Keine eindeutige Einschätzung möglich",
  keine_daten: "Für dein Gespann: Noch keine Daten verfügbar",
};

/**
 * Ordnet das konkrete Gespann des Nutzers (Länge in Metern) den
 * Community-Daten zu (§20). Erfordert einen angemeldeten Nutzer mit
 * hinterlegtem Wohnwagen -- ohne Daten wird "keine_daten" zurückgegeben.
 */
export function assessPersonalCompatibility(
  summary: CommunitySuitabilitySummary,
  userTrailerLengthM: number | null
): PersonalCompatibility {
  if (userTrailerLengthM === null) return "keine_daten";
  if (summary.reviewCount < MIN_REVIEWS_FOR_SUMMARY) return "unklar";

  const isLargeTrailer = userTrailerLengthM > LARGE_TRAILER_THRESHOLD_M;
  const relevantRatio = isLargeTrailer ? summary.largeTrailerRatio : summary.normalTrailerRatio;

  // Nicht genug spezifische Daten fuer diese Gespanngroesse -> Gesamtwert nutzen
  const ratio = relevantRatio ?? summary.overallPositiveRatio;
  if (ratio === null) return "unklar";

  return ratio >= 0.7 ? "sehr_gut" : "eingeschraenkt";
}

/**
 * Verteilung der Bewertungen nach Gespannlänge (§18-Erweiterung: "welches
 * Auto/welcher Wohnwagen"). Zeigt je Längen-Klasse den Anteil der
 * Bewertungen und wie tauglich der Ladepunkt in dieser Klasse eingeschätzt
 * wird -- z. B. "30 % der Bewertungen: 9-11 m, davon 90 % positiv".
 * Klassengrenzen hier zentral, spaeter ggf. datengetrieben anpassbar.
 */
export interface RigLengthBucket {
  label: string;
  minM: number;
  maxM: number;
}

export const RIG_LENGTH_BUCKETS: RigLengthBucket[] = [
  { label: "bis 9 m", minM: 0, maxM: 9 },
  { label: "9–11 m", minM: 9, maxM: 11 },
  { label: "11–13 m", minM: 11, maxM: 13 },
  { label: "13–15 m", minM: 13, maxM: 15 },
  { label: "über 15 m", minM: 15, maxM: Infinity },
];

export interface RigLengthBucketResult extends RigLengthBucket {
  count: number;
  sharePercent: number;
  positiveRatio: number | null;
  reliable: boolean; // genug Bewertungen fuer eine belastbare Aussage
}

export interface RigLengthDistribution {
  reviewsWithLength: number;
  reviewsWithoutLength: number;
  buckets: RigLengthBucketResult[];
}

/**
 * Ordnet alle Bewertungen mit bekannter Gespannlänge (Zugfahrzeug +
 * Wohnwagen, `trailer_length_m`) einer Längen-Klasse zu.
 */
export function bucketReviewsByRigLength(reviews: ChargingReview[]): RigLengthDistribution {
  const withLength = reviews.filter(
    (r): r is ChargingReview & { trailer_length_m: number } => r.trailer_length_m !== null
  );
  const total = withLength.length;

  const buckets = RIG_LENGTH_BUCKETS.map((bucket, index) => {
    const inBucket = withLength.filter((r) => {
      if (bucket.maxM === Infinity) return r.trailer_length_m > bucket.minM;
      if (index === 0) return r.trailer_length_m <= bucket.maxM;
      return r.trailer_length_m > bucket.minM && r.trailer_length_m <= bucket.maxM;
    });

    return {
      ...bucket,
      count: inBucket.length,
      sharePercent: total > 0 ? Math.round((inBucket.length / total) * 100) : 0,
      positiveRatio: positiveRatio(inBucket),
      reliable: inBucket.length >= MIN_REVIEWS_PER_BUCKET,
    };
  });

  return {
    reviewsWithLength: total,
    reviewsWithoutLength: reviews.length - total,
    buckets,
  };
}
