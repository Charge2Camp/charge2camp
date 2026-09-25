import type { RigLengthDistribution } from "@/lib/scoring/trailer-compatibility";

function suitabilityColor(ratio: number | null): string {
  if (ratio === null) return "#9ca3af"; // grau
  if (ratio >= 0.8) return "#059669"; // gruen
  if (ratio >= 0.5) return "#d97706"; // gelb/orange
  return "#dc2626"; // rot
}

export function RigLengthDistributionChart({
  distribution,
}: {
  distribution: RigLengthDistribution;
}) {
  if (distribution.reviewsWithLength === 0) {
    return (
      <p className="text-sm text-text-muted">
        Noch keine Bewertungen mit Gespannlänge vorhanden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">
        Verteilung der {distribution.reviewsWithLength} Bewertungen mit bekannter Gespannlänge
        (Zugfahrzeug + Wohnwagen) und wie tauglich der Ladepunkt in dieser Klasse eingeschätzt wird.
      </p>

      {distribution.buckets.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-2 text-sm sm:gap-3">
          <span className="w-14 shrink-0 text-black/70 dark:text-white/70 sm:w-16">{bucket.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            {bucket.count > 0 && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${bucket.sharePercent}%`,
                  backgroundColor: suitabilityColor(bucket.positiveRatio),
                }}
              />
            )}
            {/* Keine eigenen Bewertungen dieser Laenge, aber ein laengeres
                Gespann hat "passt" bestaetigt (Nutzerwunsch, siehe
                bucketReviewsByRigLength inheritedPositive) -- volle Breite
                in der Eignungsfarbe statt eines leeren Balkens, da diese
                Klasse noch nicht in der Laengenverteilung auftaucht. */}
            {bucket.count === 0 && bucket.inferredOnly && (
              <div className="h-full w-full rounded-full opacity-40" style={{ backgroundColor: suitabilityColor(bucket.positiveRatio) }} />
            )}
          </div>
          <span className="w-8 shrink-0 text-right text-text-muted sm:w-10">
            {bucket.sharePercent}%
          </span>
          <span className="w-20 shrink-0 truncate text-right text-xs text-text-muted sm:w-32">
            {bucket.count === 0 && !bucket.inferredOnly
              ? "keine Bewertungen"
              : bucket.reliable && bucket.positiveRatio !== null
                ? `${Math.round(bucket.positiveRatio * 100)}% positiv${bucket.inferredOnly ? " (größere Gespanne)" : ""}`
                : `${bucket.count} Bewertung${bucket.count === 1 ? "" : "en"}`}
          </span>
        </div>
      ))}

      {distribution.reviewsWithoutLength > 0 && (
        <p className="text-xs text-black/40 dark:text-white/40">
          {distribution.reviewsWithoutLength} weitere Bewertung(en) ohne Angabe zur Gespannlänge.
        </p>
      )}
    </div>
  );
}
