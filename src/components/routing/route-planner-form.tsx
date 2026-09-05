"use client";

import { useMemo, useState } from "react";
import { planRoute, replanChargingStop, type RoutePlanResult } from "@/app/routenplaner/actions";
import { MapView } from "@/components/map/map-view";
import { RouteOverviewDialog } from "@/components/routing/route-overview-dialog";
import {
  DEFAULT_CONSUMPTION_KWH_PER_100KM,
  DEFAULT_DEPARTURE_SOC_PERCENT,
  DEFAULT_DETOUR_TOLERANCE_KM,
  DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT,
  DEFAULT_MIN_SOC_AT_STOP_PERCENT,
  DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT,
  MAX_DETOUR_TOLERANCE_KM,
} from "@/lib/route-planning";
import { TRAILER_SUITABILITY_COLORS, TRAILER_SUITABILITY_LABELS } from "@/lib/trailer-suitability";
import type { Caravan, Vehicle } from "@/types/database";

function SocSlider({
  name,
  label,
  value,
  onChange,
  unit = "%",
  max = 100,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        name={name}
        type="range"
        min="0"
        max={max}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-emerald-600"
      />
    </label>
  );
}

const CONSUMPTION_SOURCE_LABELS = {
  manual: "manuell eingegeben",
  profile: "aus deinem Fahrzeugprofil",
  default: `Standardwert (${DEFAULT_CONSUMPTION_KWH_PER_100KM} kWh/100km, kein Profil-/Eingabewert vorhanden)`,
} as const;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
}

export function RoutePlannerForm({
  vehicles,
  caravans,
}: {
  vehicles: Vehicle[];
  caravans: Caravan[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoutePlanResult | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [caravanId, setCaravanId] = useState("");
  const [consumption, setConsumption] = useState("");
  const [minPowerKw, setMinPowerKw] = useState("");
  const [preferTrailerSuitable, setPreferTrailerSuitable] = useState(true);
  const [departureSoc, setDepartureSoc] = useState(DEFAULT_DEPARTURE_SOC_PERCENT);
  const [minSocAtStop, setMinSocAtStop] = useState(DEFAULT_MIN_SOC_AT_STOP_PERCENT);
  const [minSocAtDestination, setMinSocAtDestination] = useState(
    DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT
  );
  const [targetSocAfterCharging, setTargetSocAfterCharging] = useState(
    DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT
  );
  const [detourTolerance, setDetourTolerance] = useState(DEFAULT_DETOUR_TOLERANCE_KM);
  const [excludedStationIds, setExcludedStationIds] = useState<string[]>([]);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [replanBusy, setReplanBusy] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  function handleVehicleSelect(id: string) {
    setVehicleId(id);
    const v = vehicleById.get(id);
    setConsumption(v?.consumption_kwh_per_100km?.toString() ?? "");
  }

  // Setzt nur die Formulareingaben zurueck, nicht die berechnete Route --
  // die bleibt sichtbar, bis eine neue Planung gestartet wird (siehe
  // "Neue Routenplanung"-Button), damit Ladeeinstellungen mehrfach
  // angepasst werden koennen, ohne Start/Ziel/Fahrzeug erneut eingeben zu
  // muessen.
  function handleNewPlanning() {
    setResult(null);
    setError(null);
    setStart("");
    setEnd("");
    setVehicleId("");
    setCaravanId("");
    setConsumption("");
    setMinPowerKw("");
    setPreferTrailerSuitable(true);
    setDepartureSoc(DEFAULT_DEPARTURE_SOC_PERCENT);
    setMinSocAtStop(DEFAULT_MIN_SOC_AT_STOP_PERCENT);
    setMinSocAtDestination(DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT);
    setTargetSocAfterCharging(DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT);
    setDetourTolerance(DEFAULT_DETOUR_TOLERANCE_KM);
    setExcludedStationIds([]);
    setOverviewOpen(false);
    setReplanError(null);
  }

  // Ruft die Ladeplanung neu ab, ohne Start/Ziel neu zu geocodieren oder die
  // Route neu zu berechnen (Streckengeometrie bleibt gleich) -- genutzt zum
  // Loeschen eines vorgeschlagenen Ladestopps oder Waehlen einer Alternative
  // aus der Routenuebersicht.
  async function handleReplan(overrides: { excludedStationIds?: string[]; forcedStationId?: string }) {
    if (!result) return;
    setReplanBusy(true);
    setReplanError(null);
    try {
      const newPlan = await replanChargingStop({
        vehicleId,
        caravanId: caravanId || undefined,
        route: { distanceKm: result.plan.distanceKm, durationMin: result.plan.durationMin, geometry: result.geometry },
        consumptionKwhPer100km: result.plan.effectiveConsumptionKwhPer100km,
        preferTrailerSuitable,
        minPowerKw: minPowerKw ? Number(minPowerKw) : undefined,
        departureSocPercent: departureSoc,
        minSocAtStopPercent: minSocAtStop,
        minSocAtDestinationPercent: minSocAtDestination,
        targetSocAfterChargingPercent: targetSocAfterCharging,
        detourToleranceKm: detourTolerance,
        excludedStationIds: overrides.excludedStationIds ?? excludedStationIds,
        forcedStationId: overrides.forcedStationId,
      });
      setResult({ ...result, plan: newPlan });
      if (overrides.excludedStationIds) setExcludedStationIds(overrides.excludedStationIds);
    } catch (err) {
      setReplanError(err instanceof Error ? err.message : "Ladestopp konnte nicht neu geplant werden.");
    } finally {
      setReplanBusy(false);
    }
  }

  function handleDeleteStop(stationId: string) {
    handleReplan({ excludedStationIds: [...excludedStationIds, stationId] });
  }

  function handleSelectAlternative(stationId: string) {
    handleReplan({ forcedStationId: stationId });
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          // Bewusst ein normaler onSubmit-Handler statt der React-
          // action-Prop: React setzt Formulare nach einer erfolgreichen
          // action automatisch zurueck, wodurch Start/Ziel/Fahrzeug bei
          // erneuter Berechnung (z. B. nach Anpassen der Ladeeinstellungen)
          // verschwinden wuerden. Der bisherige Ergebnis-Stand bleibt
          // zudem sichtbar, bis die neue Route eintrifft.
          const formData = new FormData(e.currentTarget);
          setLoading(true);
          setError(null);
          try {
            const planResult = await planRoute(formData);
            setResult(planResult);
            setExcludedStationIds([]);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Route konnte nicht berechnet werden.");
          } finally {
            setLoading(false);
          }
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          Start *
          <input
            name="start"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="z. B. München"
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Ziel *
          <input
            name="end"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="z. B. Porec, Kroatien"
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Elektroauto *
          <select
            name="vehicle_id"
            required
            value={vehicleId}
            onChange={(e) => handleVehicleSelect(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Bitte wählen…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.manufacturer} {v.model}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Wohnwagen (optional)
          <select
            name="caravan_id"
            value={caravanId}
            onChange={(e) => setCaravanId(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Kein Wohnwagen</option>
            {caravans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Verbrauch mit Gespann (kWh/100km)
          <input
            name="consumption_kwh_per_100km"
            type="number"
            step="0.1"
            min="0"
            value={consumption}
            onChange={(e) => setConsumption(e.target.value)}
            placeholder={`z. B. ${DEFAULT_CONSUMPTION_KWH_PER_100KM} (Standard, falls kein Wert bekannt)`}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Mindest-Ladeleistung (kW, optional)
          <input
            name="min_power_kw"
            type="number"
            step="1"
            min="0"
            value={minPowerKw}
            onChange={(e) => setMinPowerKw(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10 sm:col-span-2">
          <p className="mb-3 text-sm font-medium">Ladeeinstellungen</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SocSlider
              name="departure_soc_percent"
              label="Ladestand bei Abfahrt"
              value={departureSoc}
              onChange={setDepartureSoc}
            />
            <SocSlider
              name="min_soc_at_stop_percent"
              label="Mindest-Restakku bei Zwischenladung"
              value={minSocAtStop}
              onChange={setMinSocAtStop}
            />
            <SocSlider
              name="min_soc_at_destination_percent"
              label="Mindest-Restakku am Ziel"
              value={minSocAtDestination}
              onChange={setMinSocAtDestination}
            />
            <SocSlider
              name="target_soc_after_charging_percent"
              label="Ladeziel an Zwischenstopps"
              value={targetSocAfterCharging}
              onChange={setTargetSocAfterCharging}
            />
            <div className="sm:col-span-2">
              <SocSlider
                name="detour_tolerance_km"
                label="Umweg-Toleranz für anhängertauglichere Ladepunkte"
                value={detourTolerance}
                onChange={setDetourTolerance}
                unit=" km"
                max={MAX_DETOUR_TOLERANCE_KM}
              />
              <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                Wie viele km Umweg bist du bereit zu fahren, um statt des nächstgelegenen einen
                anhängertauglicheren Ladepunkt anzusteuern?
              </p>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            name="prefer_trailer_suitable"
            value="1"
            checked={preferTrailerSuitable}
            onChange={(e) => setPreferTrailerSuitable(e.target.checked)}
          />
          Anhängertaugliche Ladepunkte bevorzugen
        </label>

        {vehicles.length === 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400 sm:col-span-2">
            Du hast noch kein Elektroauto im Profil hinterlegt. Bitte zuerst im{" "}
            <a href="/profil" className="underline">
              Profil
            </a>{" "}
            ergänzen.
          </p>
        )}

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={loading || vehicles.length === 0}
            className="rounded-md bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading
              ? "Route wird berechnet…"
              : result
                ? "Route mit angepassten Einstellungen neu berechnen"
                : "Route berechnen"}
          </button>
          {result && (
            <button
              type="button"
              onClick={handleNewPlanning}
              className="rounded-md border border-black/15 px-5 py-2.5 font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              Neue Routenplanung
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setOverviewOpen(true)}
              className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
            >
              Routenübersicht anzeigen
            </button>
          </div>

          {replanError && <p className="text-sm text-red-600">{replanError}</p>}

          <div className="h-[400px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            <MapView
              markers={[
                { id: "start", latitude: result.start.latitude, longitude: result.start.longitude, label: "Start" },
                { id: "end", latitude: result.end.latitude, longitude: result.end.longitude, label: "Ziel" },
                ...(result.plan.chargingStop
                  ? [
                      {
                        id: "charging-stop",
                        latitude: result.plan.chargingStop.station.latitude,
                        longitude: result.plan.chargingStop.station.longitude,
                        label: result.plan.chargingStop.station.name ?? "Ladestopp",
                        color: "#f59e0b",
                      },
                    ]
                  : []),
              ]}
              route={result.geometry}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-black/50 dark:text-white/50">Strecke</p>
              <p className="text-lg font-semibold">{result.plan.distanceKm.toFixed(0)} km</p>
            </div>
            <div>
              <p className="text-black/50 dark:text-white/50">Fahrzeit</p>
              <p className="text-lg font-semibold">{formatDuration(result.plan.durationMin)}</p>
            </div>
            <div>
              <p className="text-black/50 dark:text-white/50">Verbrauch</p>
              <p className="text-lg font-semibold">
                {result.plan.effectiveConsumptionKwhPer100km.toFixed(1)} kWh/100km
              </p>
            </div>
            <div>
              <p className="text-black/50 dark:text-white/50">Reichweite (Gespann)</p>
              <p className="text-lg font-semibold">{result.plan.effectiveRangeKm.toFixed(0)} km</p>
            </div>
          </div>

          <p className="text-sm text-black/60 dark:text-white/60">
            {result.vehicle.manufacturer} {result.vehicle.model}
            {result.caravan && ` + ${result.caravan.manufacturer} ${result.caravan.model}`} ·{" "}
            {result.start.displayName} → {result.end.displayName}
          </p>
          <p className="-mt-4 text-xs text-black/40 dark:text-white/40">
            Verbrauch {CONSUMPTION_SOURCE_LABELS[result.consumptionSource]}.
          </p>

          {result.plan.warning && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              {result.plan.warning}
            </p>
          )}

          {!result.plan.chargingStopRequired ? (
            <p className="rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              Kein Ladestopp nötig — die Strecke liegt innerhalb der Reichweite deines Gespanns.
              {result.plan.arrivalSocPercent !== null &&
                ` Voraussichtlicher Ankunfts-Ladestand: ${result.plan.arrivalSocPercent.toFixed(0)}%.`}
            </p>
          ) : (
            result.plan.chargingStop && (
              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <p className="font-medium">Geplanter Ladestopp</p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs text-white"
                    style={{
                      backgroundColor:
                        TRAILER_SUITABILITY_COLORS[result.plan.chargingStop.station.trailer_suitable],
                    }}
                  >
                    {TRAILER_SUITABILITY_LABELS[result.plan.chargingStop.station.trailer_suitable]}
                  </span>
                  <span className="text-sm">
                    {result.plan.chargingStop.station.name ?? result.plan.chargingStop.station.provider}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
                  <li>Nach {result.plan.chargingStop.distanceFromStartKm.toFixed(0)} km ab Start</li>
                  <li>Umweg von der Route: ca. {result.plan.chargingStop.corridorDistanceKm.toFixed(0)} km</li>
                  {result.plan.chargingStop.socOnArrivalPercent !== null && (
                    <li>Ladestand bei Ankunft: {result.plan.chargingStop.socOnArrivalPercent.toFixed(0)}%</li>
                  )}
                  {result.plan.chargingStop.chargingTimeMin !== null && (
                    <li>Voraussichtliche Ladezeit: {formatDuration(result.plan.chargingStop.chargingTimeMin)}</li>
                  )}
                  {result.plan.arrivalSocPercent !== null && (
                    <li>Ladestand am Ziel: {result.plan.arrivalSocPercent.toFixed(0)}%</li>
                  )}
                </ul>
              </div>
            )
          )}
        </div>
      )}

      {result && (
        <RouteOverviewDialog
          open={overviewOpen}
          onClose={() => setOverviewOpen(false)}
          result={result}
          busy={replanBusy}
          onDeleteStop={handleDeleteStop}
          onSelectAlternative={handleSelectAlternative}
        />
      )}
    </div>
  );
}
