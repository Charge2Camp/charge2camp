import type { EvScoreBreakdown } from "@/lib/scoring/ev-camping-score";

export function EvScoreBadge({
  breakdown,
  campsite,
  overrideScore,
}: {
  breakdown: EvScoreBreakdown;
  campsite: { max_charging_power_kw: number | null; number_of_charging_points: number | null; rating_avg: number | null };
  /** Manuell im Admin-Backend gesetzter Score (core.campsite.ev_score_override)
   * -- ersetzt nur die angezeigte Zahl, die "reasons"-Liste bleibt die
   * automatisch berechnete Begruendung (weiterhin informativ). */
  overrideScore?: number | null;
}) {
  const displayScore = overrideScore ?? breakdown.score;
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
    reasons.push(`Bewertung: ${campsite.rating_avg.toFixed(1)} Sterne`);
  }
  if (breakdown.dataFreshness > 0) reasons.push("aktuelle Daten");

  return (
    <div className="rounded-lg border border-route/30 bg-route/5 p-4">
      <p className="text-sm font-medium text-route">
        EV-Camping-Score
      </p>
      <p className="text-3xl font-bold">{displayScore}/100</p>
      {overrideScore != null && <p className="mt-1 text-xs text-text-muted">Manuell festgelegt</p>}
      {reasons.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-text-muted">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
