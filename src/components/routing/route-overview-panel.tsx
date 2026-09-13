"use client";

import { useState } from "react";
import type { ChargingStopCandidate, TripPlan } from "@/lib/route-planning";
import { buildRouteTimeline, type ManualWaypointWithDistance } from "@/lib/route-timeline";
import { TRAILER_PIN_COLORS, TRAILER_PIN_LABELS } from "@/lib/trailer-verdict";
import { PERSONAL_COMPATIBILITY_LABELS } from "@/lib/scoring/trailer-compatibility";
import { operatorMatchesAnyProvider } from "@/lib/charging-providers";

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
        style={{ backgroundColor: TRAILER_PIN_COLORS[candidate.station.trailerPinState] }}
      >
        {TRAILER_PIN_LABELS[candidate.station.trailerPinState]}
      </span>
      {candidate.personalCompatibility && candidate.personalCompatibility !== "keine_daten" && (
        <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs text-black/70 dark:border-white/20 dark:text-white/70">
          {PERSONAL_COMPATIBILITY_LABELS[candidate.personalCompatibility]}
        </span>
      )}
    </div>
  );
}

function lastConfirmedLabel(lastConfirmedAt: string | null | undefined): string {
  return lastConfirmedAt
    ? `Zuletzt von der Community bestätigt am ${new Date(lastConfirmedAt).toLocaleDateString("de-DE")}`
    : "Noch nicht von der Community bestätigt";
}

function AlternativeRow({
  alternative,
  disabled,
  onSelect,
  onViewDetails,
}: {
  alternative: ChargingStopCandidate;
  disabled: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-black/10 p-3 text-sm dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="font-medium">{alternative.station.name ?? alternative.station.provider}</span>
        <SuitabilityBadges candidate={alternative} />
        <span className="text-xs text-black/50 dark:text-white/50">
          {alternative.station.power_kw ? `${alternative.station.power_kw} kW` : "Ladeleistung unbekannt"} · ca.{" "}
          {alternative.corridorDistanceKm.toFixed(0)} km Umweg von der Route
        </span>
        <span className="text-xs text-black/50 dark:text-white/50">{lastConfirmedLabel(alternative.lastConfirmedAt)}</span>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="min-h-11 whitespace-nowrap rounded-md border border-route px-3 py-2 text-sm font-medium text-route hover:bg-route/10 disabled:opacity-50 "
        >
          Diesen Ladepunkt wählen
        </button>
        <button
          type="button"
          onClick={onViewDetails}
          className="min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-black/60 hover:underline dark:text-white/60"
        >
          Details ansehen
        </button>
      </div>
    </li>
  );
}

/** Detaillierte Routenuebersicht (Zeitachse Start -> Ladestopps/manuelle
 * Zwischenstopps -> Ziel, inkl. Alternativen-Auswahl je Ladestopp) --
 * frueher ein modales Pop-up (siehe git-history route-overview-dialog.tsx),
 * jetzt der Hauptinhalt von Tab 2 des Routenplaner-Assistenten
 * (route-planner-form.tsx). Aenderungen (Loeschen/Alternative waehlen)
 * wirken deshalb bewusst SOFORT auf die uebergebene `plan` -- kein
 * Entwurfs-/Uebernehmen-Verwerfen-Schritt mehr noetig, da es kein
 * ueberlagerndes Pop-up mehr gibt, das man versehentlich schliessen
 * koennte. */
export function RouteOverviewPanel({
  start,
  end,
  manualWaypoints,
  plan,
  travelTimeMin,
  busy,
  preferredProviders,
  onDeleteStop,
  onSelectAlternative,
  onViewDetails,
}: {
  start: { displayName: string; latitude: number; longitude: number };
  end: { displayName: string; latitude: number; longitude: number };
  manualWaypoints: ManualWaypointWithDistance[];
  plan: TripPlan;
  /** Gesamte Reisezeit (Minuten, laenderabhaengiges Anhaenger-Tempolimit --
   * siehe lib/travel-time.ts) der aktuell angezeigten (Umwege-inklusiven)
   * Route -- Grundlage fuer die je Etappe anteilig geschaetzte Fahrzeit
   * unten, damit deren Summe zur oben angezeigten Reisezeit passt. */
  travelTimeMin: number;
  busy: boolean;
  /** Bevorzugte Anbieter (Schluessel aus charging-providers.ts) -- rein
   * informativ fuer den Hinweis "kein bevorzugter Anbieter in der Naehe"
   * je Ladestopp (Nutzerwunsch). planTrip selbst schliesst Kandidaten
   * anderer Anbieter NICHT mehr aus (nur vermiedene Anbieter tun das
   * weiterhin hart) -- bevorzugte Anbieter werden nur bei der Auswahl
   * vorgezogen, siehe route-planning.ts. */
  preferredProviders: string[];
  onDeleteStop: (stopIndex: number, stationId: string) => void;
  onSelectAlternative: (stopIndex: number, stationId: string) => void;
  /** Speichert den aktuellen Planungsstand und oeffnet die Ladepunkt-
   * Detailseite (Nutzerwunsch: bei jeder Lade-Option die vollen Infos
   * abrufen koennen) -- mit "Zurück"-Moeglichkeit von dort, siehe
   * route-planner-form.tsx handleViewStationDetails. */
  onViewDetails: (stationId: string) => void;
}) {
  const [expandedStopIndex, setExpandedStopIndex] = useState<number | null>(null);

  // Vereint Ladestopps und manuelle Zwischenstopps (§ ABRP-Vorbild "Add
  // Stop") in einer nach Streckenposition sortierten Liste, damit die
  // Reihenfolge in der Uebersicht immer der tatsaechlichen Fahrtrichtung
  // entspricht.
  const timeline = buildRouteTimeline({
    start,
    end,
    distanceKm: plan.distanceKm,
    chargingStops: plan.chargingStops,
    manualWaypoints,
  });
  const middlePoints = timeline.slice(1, -1);

  // Etappen-km/Reisezeit werden proportional zur gesamten Reisezeit
  // geschaetzt (kein Anbieter liefert Zwischenzeiten fuer beliebige
  // Streckenpunkte beim laenderabhaengigen Tempolimit) -- gleiche Naeherung
  // wie die Korridor-Distanz der Ladepunkte selbst. travelTimeMin statt
  // plan.durationMin, damit die Summe der Etappen zur oben angezeigten
  // Gesamt-Reisezeit passt.
  const legStartKm = [0, ...middlePoints.map((p) => p.distanceFromStartKm)];
  const legEndKm = [...middlePoints.map((p) => p.distanceFromStartKm), plan.distanceKm];

  return (
    <ol className="flex flex-col gap-3">
      <li className="rounded-lg border border-route/30 bg-route/5 p-3">
        <p className="font-medium">Start: {start.displayName}</p>
        <p className="text-sm text-black/60 dark:text-white/60">Ladestand bei Abfahrt: {plan.departureSocPercent}%</p>
      </li>

      {middlePoints.map((point, i) => {
        const legDistanceKm = legEndKm[i] - legStartKm[i];
        const legDurationMin = (legDistanceKm / plan.distanceKm) * travelTimeMin;

        if (point.kind === "manual") {
          return (
            <div key={`manual-${point.label}-${point.distanceFromStartKm}`} className="contents">
              <li className="flex items-center gap-2 pl-2 text-xs text-black/50 dark:text-white/50">
                <span>↓ {legDistanceKm.toFixed(0)} km</span>
                <span>· ca. {formatDuration(legDurationMin)}</span>
              </li>
              <li className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <p className="font-medium">Zwischenstopp: {point.label}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  Manuell hinzugefügt, unabhängig von der Ladeplanung -- änderbar über das
                  Routenplaner-Formular.
                </p>
              </li>
            </div>
          );
        }

        const stop = point.chargingStop!;
        const index = point.chargingStopIndex!;
        const showAlternatives = expandedStopIndex === index;
        const missesPreferredProvider =
          preferredProviders.length > 0 && !operatorMatchesAnyProvider(stop.station.provider, preferredProviders);

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
                    <li>{lastConfirmedLabel(stop.lastConfirmedAt)}</li>
                  </ul>
                  {missesPreferredProvider && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Kein Ladepunkt eines bevorzugten Anbieters in der Nähe verfügbar -- diese Station wurde
                      stattdessen vorgeschlagen.
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteStop(index, stop.station.id)}
                    className="min-h-11 whitespace-nowrap rounded-md border border-red-600/50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-600/10 disabled:opacity-50 dark:text-red-400"
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewDetails(stop.station.id)}
                    className="min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-black/60 hover:underline dark:text-white/60"
                  >
                    Details ansehen
                  </button>
                </div>
              </div>

              {stop.alternatives.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedStopIndex(showAlternatives ? null : index)}
                    className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-route hover:underline "
                  >
                    {showAlternatives ? "Alternativen ausblenden" : `Alternativen anzeigen (${stop.alternatives.length})`}
                  </button>
                  {showAlternatives && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {stop.alternatives.map((alt) => (
                        <AlternativeRow
                          key={alt.station.id}
                          alternative={alt}
                          disabled={busy}
                          onSelect={() => {
                            // Nutzerwunsch: Abschnitt nach der Auswahl wieder
                            // einklappen, statt die (jetzt veraltete)
                            // Alternativen-Liste weiter offen zu lassen.
                            setExpandedStopIndex(null);
                            onSelectAlternative(index, alt.station.id);
                          }}
                          onViewDetails={() => onViewDetails(alt.station.id)}
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
        const legDurationMin = (legDistanceKm / plan.distanceKm) * travelTimeMin;
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

      <li className="rounded-lg border border-route/30 bg-route/5 p-3">
        <p className="font-medium">Ziel: {end.displayName}</p>
        {plan.arrivalSocPercent !== null && (
          <p className="text-sm text-black/60 dark:text-white/60">
            Voraussichtlicher Ladestand am Ziel: {plan.arrivalSocPercent.toFixed(0)}%
          </p>
        )}
      </li>
    </ol>
  );
}
