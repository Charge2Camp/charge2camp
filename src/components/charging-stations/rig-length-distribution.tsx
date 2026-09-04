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
      <p className="text-sm text-black/50 dark:text-white/50">
        Noch keine Bewertungen mit Gespannlänge vorhanden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-black/50 dark:text-white/50">
        Verteilung der {distribution.reviewsWithLength} Bewertungen mit bekannter Gespannlänge
        (Zugfahrzeug + Wohnwagen) und wie tauglich der Ladepunkt in dieser Klasse eingeschätzt wird.
      </p>

      {distribution.buckets
        .filter((b) => b.count > 0)
        .map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-black/70 dark:text-white/70">{bucket.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${bucket.sharePercent}%`,
                  backgroundColor: suitabilityColor(bucket.positiveRatio),
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-black/50 dark:text-white/50">
              {bucket.sharePercent}%
            </span>
            <span className="w-24 shrink-0 text-right text-xs text-black/50 dark:text-white/50">
              {bucket.reliable && bucket.positiveRatio !== null
                ? `${Math.round(bucket.positiveRatio * 100)}% positiv`
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
