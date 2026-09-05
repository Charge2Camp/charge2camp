"use client";

import { useState } from "react";
import type { RoutePlanResult } from "@/app/routenplaner/actions";
import type { ChargingStopCandidate } from "@/lib/route-planning";
import { TRAILER_SUITABILITY_COLORS, TRAILER_SUITABILITY_LABELS } from "@/lib/trailer-suitability";
import { PERSONAL_COMPATIBILITY_LABELS } from "@/lib/scoring/trailer-compatibility";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
}

function SuitabilityBadges({ candidate }: { candidate: Pick<ChargingStopCandidate, "station" | "personalCompatibility"> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 text-xs text-white"
        style={{ backgroundColor: TRAILER_SUITABILITY_COLORS[candidate.station.trailer_suitable] }}
      >
        {TRAILER_SUITABILITY_LABELS[candidate.station.trailer_suitable]}
      </span>
      {candidate.personalCompatibility && candidate.personalCompatibility !== "keine_daten" && (
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs text-black/70 dark:border-white/20 dark:text-white/70">
          {PERSONAL_COMPATIBILITY_LABELS[candidate.personalCompatibility]}
        </span>
      )}
    </div>
  );
}

function AlternativeRow({
  alternative,
  disabled,
  onSelect,
}: {
  alternative: ChargingStopCandidate;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {alternative.station.name ?? alternative.station.provider}
        </span>
        <SuitabilityBadges candidate={alternative} />
        <span className="text-xs text-black/50 dark:text-white/50">
          {alternative.station.power_kw ? `${alternative.station.power_kw} kW` : "Ladeleistung unbekannt"} · ca.{" "}
          {alternative.corridorDistanceKm.toFixed(0)} km Umweg von der Route
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="whitespace-nowrap rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-600/10 disabled:opacity-50 dark:text-emerald-400"
      >
        Diesen Ladepunkt wählen
      </button>
    </li>
  );
}

export function RouteOverviewDialog({
  open,
  onClose,
  result,
  busy,
  onDeleteStop,
  onSelectAlternative,
}: {
  open: boolean;
  onClose: () => void;
  result: RoutePlanResult;
  busy: boolean;
  onDeleteStop: (stationId: string) => void;
  onSelectAlternative: (stationId: string) => void;
}) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!open) return null;

  const { plan } = result;
  const chargingStop = plan.chargingStop;

  const durationToStopMin = chargingStop
    ? (chargingStop.distanceFromStartKm / plan.distanceKm) * plan.durationMin
    : null;
  const remainingDurationMin = durationToStopMin !== null ? plan.durationMin - durationToStopMin : null;
  const remainingDistanceKm = chargingStop ? plan.distanceKm - chargingStop.distanceFromStartKm : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <h2 className="text-lg font-semibold">Routenübersicht</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md px-2 py-1 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ol className="flex flex-col gap-3">
            <li className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
              <p className="font-medium">Start: {result.start.displayName}</p>
              <p className="text-sm text-black/60 dark:text-white/60">
                Ladestand bei Abfahrt: {plan.departureSocPercent}%
              </p>
            </li>

            {chargingStop ? (
              <>
                <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                  <span>↓ {chargingStop.distanceFromStartKm.toFixed(0)} km</span>
                  {durationToStopMin !== null && <span>· ca. {formatDuration(durationToStopMin)}</span>}
                </li>

                <li className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <p className="font-medium">
                        {chargingStop.station.name ?? chargingStop.station.provider}
                      </p>
                      <SuitabilityBadges candidate={chargingStop} />
                      <p className="text-sm text-black/60 dark:text-white/60">
                        {chargingStop.station.power_kw ? `${chargingStop.station.power_kw} kW` : "Ladeleistung unbekannt"}
                        {" · "}ca. {chargingStop.corridorDistanceKm.toFixed(0)} km Umweg von der Route
                      </p>
                      <ul className="text-sm text-black/60 dark:text-white/60">
                        <li>Ladestand bei Ankunft: {chargingStop.socOnArrivalPercent.toFixed(0)}%</li>
                        {chargingStop.chargingTimeMin !== null && (
                          <li>Voraussichtliche Ladezeit: {formatDuration(chargingStop.chargingTimeMin)}</li>
                        )}
                      </ul>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDeleteStop(chargingStop.station.id)}
                      className="whitespace-nowrap rounded-md border border-red-600/50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-600/10 disabled:opacity-50 dark:text-red-400"
                    >
                      Löschen
                    </button>
                  </div>

                  {chargingStop.alternatives.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowAlternatives((v) => !v)}
                        className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {showAlternatives
                          ? "Alternativen ausblenden"
                          : `Alternativen anzeigen (${chargingStop.alternatives.length})`}
                      </button>
                      {showAlternatives && (
                        <ul className="mt-2 flex flex-col gap-2">
                          {chargingStop.alternatives.map((alt) => (
                            <AlternativeRow
                              key={alt.station.id}
                              alternative={alt}
                              disabled={busy}
                              onSelect={() => onSelectAlternative(alt.station.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>

                <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                  <span>↓ {remainingDistanceKm?.toFixed(0)} km</span>
                  {remainingDurationMin !== null && <span>· ca. {formatDuration(remainingDurationMin)}</span>}
                </li>
              </>
            ) : (
              <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                <span>↓ {plan.distanceKm.toFixed(0)} km</span>
                <span>· ca. {formatDuration(plan.durationMin)}</span>
              </li>
            )}

            {plan.chargingStopRequired && !chargingStop && (
              <li className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                {plan.warning}
              </li>
            )}

            <li className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
              <p className="font-medium">Ziel: {result.end.displayName}</p>
              {plan.arrivalSocPercent !== null && (
                <p className="text-sm text-black/60 dark:text-white/60">
                  Voraussichtlicher Ladestand am Ziel: {plan.arrivalSocPercent.toFixed(0)}%
                </p>
              )}
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
