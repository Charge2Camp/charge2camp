import type { EvScoreBreakdown } from "@/lib/scoring/ev-camping-score";

export function EvScoreBadge({
  breakdown,
  campsite,
}: {
  breakdown: EvScoreBreakdown;
  campsite: { max_charging_power_kw: number | null; number_of_charging_points: number | null; rating_avg: number | null };
}) {
  const reasons: string[] = [];
  if (breakdown.onSite > 0) reasons.push("Ladepunkt auf dem Platz");
  if (breakdown.power > 0 && campsite.max_charging_power_kw) {
    reasons.push(`${campsite.max_charging_power_kw} kW`);
  }
  if (breakdown.pointCount > 0 && campsite.number_of_charging_points) {
    reasons.push(`${campsite.number_of_charging_points} Ladepunkte`);
  }
  if (breakdown.nearestFastChargerKm !== null) {
    reasons.push(`Schnelllader ${breakdown.nearestFastChargerKm.toFixed(1)} km entfernt`);
  }
  if (breakdown.communityRating > 0 && campsite.rating_avg) {
    reasons.push(`positive Community-Bewertungen (★ ${campsite.rating_avg.toFixed(1)})`);
  }
  if (breakdown.dataFreshness > 0) reasons.push("aktuelle Daten");

  return (
    <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        EV-Camping-Score
      </p>
      <p className="text-3xl font-bold">{breakdown.score}/100</p>
      {reasons.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-black/60 dark:text-white/60">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
