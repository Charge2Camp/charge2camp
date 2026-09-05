"use client";

import { useState } from "react";
import type { ChargingStopCandidate, TripPlan } from "@/lib/route-planning";
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
  start,
  end,
  plan,
  busy,
  dirty,
  confirmingClose,
  onRequestClose,
  onApplyChanges,
  onDiscardChanges,
  onCancelClose,
  onDeleteStop,
  onSelectAlternative,
}: {
  open: boolean;
  start: { displayName: string };
  end: { displayName: string };
  plan: TripPlan;
  busy: boolean;
  /** true, sobald in diesem Popup geloescht oder eine Alternative gewaehlt wurde, ohne dass die Aenderung schon uebernommen wurde. */
  dirty: boolean;
  /** true, waehrend der Nutzer beim Schliessversuch gefragt wird, ob die Aenderungen uebernommen oder verworfen werden sollen. */
  confirmingClose: boolean;
  onRequestClose: () => void;
  onApplyChanges: () => void;
  onDiscardChanges: () => void;
  onCancelClose: () => void;
  onDeleteStop: (stopIndex: number, stationId: string) => void;
  onSelectAlternative: (stopIndex: number, stationId: string) => void;
}) {
  const [expandedStopIndex, setExpandedStopIndex] = useState<number | null>(null);

  if (!open) return null;

  const stops = plan.chargingStops;

  // Etappen-km/Fahrzeit werden proportional zur Gesamtfahrzeit geschaetzt
  // (OSRM liefert keine Zwischenzeiten fuer beliebige Streckenpunkte) --
  // gleiche Naeherung wie die Korridor-Distanz der Ladepunkte selbst.
  const legStartKm = [0, ...stops.map((s) => s.distanceFromStartKm)];
  const legEndKm = [...stops.map((s) => s.distanceFromStartKm), plan.distanceKm];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <h2 className="text-lg font-semibold">Routenübersicht</h2>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Schließen"
            className="rounded-md px-2 py-1 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {confirmingClose ? (
          <div className="p-5">
            <p className="font-medium">Änderungen an der Ladeplanung übernehmen?</p>
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              Du hast Ladepunkte gelöscht oder Alternativen gewählt. Diese Änderungen sind bisher nur eine
              Vorschau — wähle, ob sie in deine Routenplanung übernommen oder verworfen werden sollen.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onApplyChanges}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Änderungen übernehmen
              </button>
              <button
                type="button"
                onClick={onDiscardChanges}
                className="rounded-md border border-red-600/50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-600/10 dark:text-red-400"
              >
                Änderungen verwerfen
              </button>
              <button
                type="button"
                onClick={onCancelClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Weiter bearbeiten
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <ol className="flex flex-col gap-3">
              <li className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
                <p className="font-medium">Start: {start.displayName}</p>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Ladestand bei Abfahrt: {plan.departureSocPercent}%
                </p>
              </li>

              {stops.map((stop, index) => {
                const legDistanceKm = legEndKm[index] - legStartKm[index];
                const legDurationMin = (legDistanceKm / plan.distanceKm) * plan.durationMin;
                const showAlternatives = expandedStopIndex === index;

                return (
                  <div key={stop.station.id} className="contents">
                    <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                      <span>↓ {legDistanceKm.toFixed(0)} km</span>
                      <span>· ca. {formatDuration(legDurationMin)}</span>
                    </li>

                    <li className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1.5">
                          <p className="font-medium">
                            {index + 1}. Ladestopp: {stop.station.name ?? stop.station.provider}
                          </p>
                          <SuitabilityBadges candidate={stop} />
                          <p className="text-sm text-black/60 dark:text-white/60">
                            {stop.station.power_kw ? `${stop.station.power_kw} kW` : "Ladeleistung unbekannt"}
                            {" · "}ca. {stop.corridorDistanceKm.toFixed(0)} km Umweg von der Route
                          </p>
                          <ul className="text-sm text-black/60 dark:text-white/60">
                            <li>Ladestand bei Ankunft: {stop.socOnArrivalPercent.toFixed(0)}%</li>
                            {stop.chargingTimeMin !== null && (
                              <li>Voraussichtliche Ladezeit: {formatDuration(stop.chargingTimeMin)}</li>
                            )}
                          </ul>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDeleteStop(index, stop.station.id)}
                          className="whitespace-nowrap rounded-md border border-red-600/50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-600/10 disabled:opacity-50 dark:text-red-400"
                        >
                          Löschen
                        </button>
                      </div>

                      {stop.alternatives.length > 0 && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setExpandedStopIndex(showAlternatives ? null : index)}
                            className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            {showAlternatives
                              ? "Alternativen ausblenden"
                              : `Alternativen anzeigen (${stop.alternatives.length})`}
                          </button>
                          {showAlternatives && (
                            <ul className="mt-2 flex flex-col gap-2">
                              {stop.alternatives.map((alt) => (
                                <AlternativeRow
                                  key={alt.station.id}
                                  alternative={alt}
                                  disabled={busy}
                                  onSelect={() => onSelectAlternative(index, alt.station.id)}
                                />
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  </div>
                );
              })}

              {(() => {
                const lastIndex = legEndKm.length - 1;
                const legDistanceKm = legEndKm[lastIndex] - legStartKm[lastIndex];
                const legDurationMin = (legDistanceKm / plan.distanceKm) * plan.durationMin;
                return (
                  <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                    <span>↓ {legDistanceKm.toFixed(0)} km</span>
                    <span>· ca. {formatDuration(legDurationMin)}</span>
                  </li>
                );
              })()}

              {plan.chargingStopsRequired && plan.arrivalSocPercent === null && (
                <li className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                  {plan.warning}
                </li>
              )}

              <li className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
                <p className="font-medium">Ziel: {end.displayName}</p>
                {plan.arrivalSocPercent !== null && (
                  <p className="text-sm text-black/60 dark:text-white/60">
                    Voraussichtlicher Ladestand am Ziel: {plan.arrivalSocPercent.toFixed(0)}%
                  </p>
                )}
              </li>
            </ol>
          </div>
        )}

        {!confirmingClose && dirty && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 p-4 dark:border-white/10">
            <p className="text-xs text-black/50 dark:text-white/50">Ungespeicherte Änderungen an der Ladeplanung.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onApplyChanges}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Übernehmen
              </button>
              <button
                type="button"
                onClick={onDiscardChanges}
                className="rounded-md border border-red-600/50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-600/10 dark:text-red-400"
              >
                Verwerfen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
