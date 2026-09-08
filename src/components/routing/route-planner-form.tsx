"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadSavedRoute,
  planRoute,
  replanChargingStop,
  saveRoute,
  type RoutePlanResult,
} from "@/app/routenplaner/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MapView } from "@/components/map/map-view";
import { RouteOverviewDialog } from "@/components/routing/route-overview-dialog";
import { FavoritesPickerDialog } from "@/components/routing/favorites-picker-dialog";
import { HomeAddressPickerDialog } from "@/components/routing/home-address-picker-dialog";
import {
  DEFAULT_CONSUMPTION_KWH_PER_100KM,
  DEFAULT_DEPARTURE_SOC_PERCENT,
  DEFAULT_DETOUR_TOLERANCE_KM,
  DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT,
  DEFAULT_MIN_SOC_AT_STOP_PERCENT,
  DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT,
  MAX_DETOUR_TOLERANCE_KM,
  type TripPlan,
} from "@/lib/route-planning";
import { googleMapsNavigationProvider } from "@/lib/providers/navigation";
import { buildRouteTimeline } from "@/lib/route-timeline";
import { TRAILER_SUITABILITY_COLORS, TRAILER_SUITABILITY_ICON_SRC, TRAILER_SUITABILITY_LABELS } from "@/lib/trailer-suitability";
import type { CampsiteDestinationOption } from "@/lib/campsites";
import type { FavoriteDestinationOption } from "@/lib/favorites";
import type { Caravan, Vehicle } from "@/types/database";
import { useDelayedLoading } from "@/lib/use-delayed-loading";
import { LoadingIndicator } from "@/components/loading-indicator";

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
        className="accent-route"
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Popup-Inhalt fuer den Ladestopp-Marker auf der Routenkarte (MapView,
// popupHtml) -- dieselben Angaben wie die Ladestopp-Karten unten im
// Ergebnis, damit man sie nicht erst suchen/scrollen muss, um zu sehen,
// worum es bei einem angetippten Pin geht.
function buildChargingStopPopupHtml(stop: RoutePlanResult["plan"]["chargingStops"][number], index: number): string {
  const name = escapeHtml(stop.station.name ?? stop.station.provider ?? "Ladepunkt");
  const badgeColor = TRAILER_SUITABILITY_COLORS[stop.station.trailer_suitable];
  const badgeLabel = escapeHtml(TRAILER_SUITABILITY_LABELS[stop.station.trailer_suitable]);
  const confirmedLine = stop.lastConfirmedAt
    ? `Zuletzt von der Community bestätigt am ${new Date(stop.lastConfirmedAt).toLocaleDateString("de-DE")}`
    : "Noch nicht von der Community bestätigt";
  const costLine =
    stop.estimatedCostEur !== null ? `${stop.estimatedCostEur.toFixed(2)} €` : "unbekannt (kein Preis hinterlegt)";

  return `
    <div style="font-family: var(--font-ui, system-ui), sans-serif; font-size: 13px; line-height: 1.5; max-width: 240px;">
      <p style="font-weight: 600; margin: 0 0 4px;">${index + 1}. Ladestopp</p>
      <span style="display: inline-block; background: ${badgeColor}; color: white; border-radius: 999px; padding: 1px 8px; font-size: 11px; margin-bottom: 6px;">${badgeLabel}</span>
      <p style="margin: 0 0 6px; font-weight: 500;">${name}</p>
      <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; opacity: 0.8;">
        <li>Nach ${stop.distanceFromStartKm.toFixed(0)} km ab Start</li>
        <li>Umweg von der Route: ca. ${stop.corridorDistanceKm.toFixed(0)} km</li>
        <li>Ladestand bei Ankunft: ${stop.socOnArrivalPercent.toFixed(0)}%</li>
        ${stop.chargingTimeMin !== null ? `<li>Voraussichtliche Ladezeit: ${formatDuration(stop.chargingTimeMin)}</li>` : ""}
        <li>Geschätzte Ladekosten: ${costLine}</li>
        <li>${confirmedLine}</li>
      </ul>
    </div>
  `;
}

export function RoutePlannerForm({
  vehicles,
  caravans,
  providers,
  campsiteDestinations,
  favorites,
  homeAddress,
  initialDestination,
  initialSavedRouteId,
}: {
  vehicles: Vehicle[];
  caravans: Caravan[];
  /** Bekannte Anbieter aus charging_stations, fuer den optionalen Anbieter-Filter. */
  providers: string[];
  /** Eigene Campingplaetze (Name + Koordinaten), als zusaetzliche, erkennbare Vorschlaege im Ziel-Feld. */
  campsiteDestinations: CampsiteDestinationOption[];
  /** Vom Nutzer gemerkte Campingplaetze/Ladepunkte, fuer die Favoriten-Auswahl (Start/Ziel). */
  favorites: FavoriteDestinationOption[];
  /** Im Profil ("Meine Daten") hinterlegte Zuhause-Adresse, fuer den "Zuhause verwenden"-Button (Start/Ziel). */
  homeAddress: { name: string; latitude: number; longitude: number } | null;
  /** Vom "Route hierher planen"-Button auf einer Campingplatz- oder Ladepunkt-Detailseite (?destination_campsite_id=...  /  ?destination_station_id=...) -- befuellt "Ziel" bereits beim ersten Rendern. */
  initialDestination?: { name: string; latitude: number; longitude: number };
  /** Aus dem URL-Query-Parameter `?savedRouteId=...` (Link "Öffnen" im Profil) -- laedt die gespeicherte Route beim ersten Rendern. */
  initialSavedRouteId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const showLoadingIndicator = useDelayedLoading(loading);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoutePlanResult | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(initialDestination?.name ?? "");
  // Gesetzt, wenn "Start"/"Ziel" ueber einen unserer eigenen Campingplatz-
  // Vorschlaege (siehe AddressAutocomplete localSuggestions), ueber die
  // Favoriten-Auswahl (favorites-picker-dialog.tsx) oder bereits ueber
  // `initialDestination` vorbelegt wurde -- dann sind die Koordinaten schon
  // bekannt und muessen beim Absenden NICHT per Nominatim aus dem (bei
  // Demo-Namen ohnehin nicht auffindbaren) Text neu aufgeloest werden,
  // siehe actions.ts.
  const [startCoords, setStartCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endCoords, setEndCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialDestination ? { latitude: initialDestination.latitude, longitude: initialDestination.longitude } : null
  );
  const [favoritesDialogOpen, setFavoritesDialogOpen] = useState(false);
  const [homeDialogOpen, setHomeDialogOpen] = useState(false);
  const campsiteSuggestions = useMemo(
    () => campsiteDestinations.map((c) => ({ id: c.id, displayName: c.name, latitude: c.latitude, longitude: c.longitude })),
    [campsiteDestinations]
  );
  // Kombinierte Nachschlage-Tabelle (alle eigenen Campingplaetze + alle
  // Favoriten + Zuhause-Adresse) nach Anzeigename -- genutzt beim
  // Wiederherstellen einer gespeicherten Route, um Start/Ziel-Koordinaten
  // zurueckzubekommen, falls damals ein Campingplatz/Favorit/Zuhause
  // gewaehlt wurde (siehe useEffect unten).
  const knownPlaceByName = useMemo(() => {
    const map = new Map<string, { latitude: number; longitude: number }>();
    for (const c of campsiteSuggestions) map.set(c.displayName, { latitude: c.latitude, longitude: c.longitude });
    for (const f of favorites) map.set(f.name, { latitude: f.latitude, longitude: f.longitude });
    if (homeAddress) map.set(homeAddress.name, { latitude: homeAddress.latitude, longitude: homeAddress.longitude });
    return map;
  }, [campsiteSuggestions, favorites, homeAddress]);
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
  const [preferredProvider, setPreferredProvider] = useState("");
  const [manualStopQueries, setManualStopQueries] = useState<string[]>([]);
  const [excludedStationIds, setExcludedStationIds] = useState<string[]>([]);
  const [forcedStationIdByIndex, setForcedStationIdByIndex] = useState<Record<number, string>>({});
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [replanBusy, setReplanBusy] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);
  // Entwurfsstand waehrend die Routenuebersicht geoeffnet ist: Loeschen/
  // Alternativen-Auswahl wirkt sich zunaechst NUR hier aus. Karte und
  // Zusammenfassung ausserhalb des Popups zeigen weiterhin den zuletzt
  // bestaetigten Stand, bis der Nutzer beim Schliessen explizit "Übernehmen"
  // oder "Verwerfen" waehlt.
  const [draftPlan, setDraftPlan] = useState<TripPlan | null>(null);
  const [draftExcludedStationIds, setDraftExcludedStationIds] = useState<string[]>([]);
  const [draftForcedStationIdByIndex, setDraftForcedStationIdByIndex] = useState<Record<number, string>>({});
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [confirmingOverviewClose, setConfirmingOverviewClose] = useState(false);
  const [loadingSavedRoute, setLoadingSavedRoute] = useState(Boolean(initialSavedRouteId));
  const showSavedRouteLoadingIndicator = useDelayedLoading(loadingSavedRoute);
  const [saveRouteName, setSaveRouteName] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Vorschlag fuer den Namen beim Speichern -- waehrend des Renderns aus
  // dem Ergebnis abgeleitet statt per Effect gesetzt, damit ein bereits von
  // Hand eingegebener Name (saveRouteName) erhalten bleibt, bis der Nutzer
  // ihn aktiv aendert.
  const defaultSaveRouteName = result
    ? `${result.start.displayName.split(",")[0]} → ${result.end.displayName.split(",")[0]}`
    : "";

  // Gespeicherte Route ueber ?savedRouteId=... (Link "Öffnen" im Profil)
  // beim ersten Rendern laden und alle Formularfelder + das Ergebnis damit
  // vorbelegen.
  useEffect(() => {
    if (!initialSavedRouteId) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadSavedRoute(initialSavedRouteId);
        if (cancelled) return;
        setStart(saved.startQuery);
        setEnd(saved.endQuery);
        // Falls Start/Ziel damals ueber einen unserer Campingplatz-
        // Vorschlaege oder die Favoriten-Auswahl gewaehlt wurden, deren
        // Koordinaten wiederherstellen -- sonst wuerde ein spaeteres "neu
        // berechnen" versuchen, den (bei Demo-Namen nicht auffindbaren) Text
        // per Nominatim zu geocodieren, siehe actions.ts.
        setStartCoords(knownPlaceByName.get(saved.startQuery) ?? null);
        setEndCoords(knownPlaceByName.get(saved.endQuery) ?? null);
        setManualStopQueries(saved.manualStopQueries);
        setVehicleId(saved.vehicleId);
        setCaravanId(saved.caravanId ?? "");
        setConsumption(saved.manualConsumptionKwhPer100km?.toString() ?? "");
        setMinPowerKw(saved.minPowerKw?.toString() ?? "");
        setPreferTrailerSuitable(saved.preferTrailerSuitable);
        setPreferredProvider(saved.preferredProvider ?? "");
        setDepartureSoc(saved.departureSocPercent);
        setMinSocAtStop(saved.minSocAtStopPercent);
        setMinSocAtDestination(saved.minSocAtDestinationPercent);
        setTargetSocAfterCharging(saved.targetSocAfterChargingPercent);
        setDetourTolerance(saved.detourToleranceKm);
        setExcludedStationIds(saved.excludedStationIds);
        setForcedStationIdByIndex(saved.forcedStationIdByIndex);
        setSaveRouteName(saved.name);
        setSaveError(null);
        setSaveSuccess(false);
        setResult(saved.result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Gespeicherte Route konnte nicht geladen werden.");
        }
      } finally {
        if (!cancelled) setLoadingSavedRoute(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSavedRouteId]);

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
    setStartCoords(null);
    setEndCoords(null);
    setManualStopQueries([]);
    setVehicleId("");
    setCaravanId("");
    setConsumption("");
    setMinPowerKw("");
    setPreferTrailerSuitable(true);
    setPreferredProvider("");
    setDepartureSoc(DEFAULT_DEPARTURE_SOC_PERCENT);
    setMinSocAtStop(DEFAULT_MIN_SOC_AT_STOP_PERCENT);
    setMinSocAtDestination(DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT);
    setTargetSocAfterCharging(DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT);
    setDetourTolerance(DEFAULT_DETOUR_TOLERANCE_KM);
    setExcludedStationIds([]);
    setForcedStationIdByIndex({});
    setOverviewOpen(false);
    setDraftPlan(null);
    setOverviewDirty(false);
    setConfirmingOverviewClose(false);
    setReplanError(null);
    setSaveRouteName("");
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleOpenOverview() {
    if (!result) return;
    setDraftPlan(result.plan);
    setDraftExcludedStationIds(excludedStationIds);
    setDraftForcedStationIdByIndex(forcedStationIdByIndex);
    setOverviewDirty(false);
    setConfirmingOverviewClose(false);
    setReplanError(null);
    setOverviewOpen(true);
  }

  // Ruft die Ladeplanung neu ab, ohne Start/Ziel neu zu geocodieren oder die
  // Route neu zu berechnen (Streckengeometrie bleibt gleich) -- genutzt zum
  // Loeschen eines vorgeschlagenen Ladestopps oder Waehlen einer Alternative
  // aus der Routenuebersicht. Aendert bewusst nur den ENTWURFS-Stand, nicht
  // den bestaetigten `result`/`excludedStationIds`/`forcedStationIdByIndex`
  // -- die Uebernahme passiert erst explizit beim Schliessen des Popups.
  async function handleReplan(overrides: {
    excludedStationIds?: string[];
    forcedStationIdByIndex?: Record<number, string>;
  }) {
    if (!result) return;
    setReplanBusy(true);
    setReplanError(null);
    try {
      const nextExcluded = overrides.excludedStationIds ?? draftExcludedStationIds;
      const nextForced = overrides.forcedStationIdByIndex ?? draftForcedStationIdByIndex;
      const newPlan = await replanChargingStop({
        vehicleId,
        caravanId: caravanId || undefined,
        route: { distanceKm: result.plan.distanceKm, durationMin: result.plan.durationMin, geometry: result.geometry },
        consumptionKwhPer100km: result.plan.effectiveConsumptionKwhPer100km,
        preferTrailerSuitable,
        minPowerKw: minPowerKw ? Number(minPowerKw) : undefined,
        preferredProvider: preferredProvider || undefined,
        departureSocPercent: departureSoc,
        minSocAtStopPercent: minSocAtStop,
        minSocAtDestinationPercent: minSocAtDestination,
        targetSocAfterChargingPercent: targetSocAfterCharging,
        detourToleranceKm: detourTolerance,
        excludedStationIds: nextExcluded,
        forcedStationIdByIndex: nextForced,
      });
      setDraftPlan(newPlan);
      setDraftExcludedStationIds(nextExcluded);
      setDraftForcedStationIdByIndex(nextForced);
      setOverviewDirty(true);
    } catch (err) {
      setReplanError(err instanceof Error ? err.message : "Ladestopp konnte nicht neu geplant werden.");
    } finally {
      setReplanBusy(false);
    }
  }

  // Erzwungene Alternativen-Wahlen ab (ausschliesslich) diesem Stopp-Index
  // verwerfen -- sie haengen von der Position des geaenderten Stopps ab und
  // werden nach der Aenderung frei neu bestimmt.
  function clearForcedFrom(stopIndex: number): Record<number, string> {
    const next: Record<number, string> = {};
    for (const [key, value] of Object.entries(draftForcedStationIdByIndex)) {
      if (Number(key) < stopIndex) next[Number(key)] = value;
    }
    return next;
  }

  function handleDeleteStop(stopIndex: number, stationId: string) {
    handleReplan({
      excludedStationIds: [...draftExcludedStationIds, stationId],
      forcedStationIdByIndex: clearForcedFrom(stopIndex),
    });
  }

  function handleSelectAlternative(stopIndex: number, stationId: string) {
    handleReplan({
      forcedStationIdByIndex: { ...clearForcedFrom(stopIndex), [stopIndex]: stationId },
    });
  }

  // Schliessen angefordert (X-Button im Popup): bei ungespeicherten
  // Aenderungen erst explizit nachfragen, statt sie stillschweigend zu
  // uebernehmen oder zu verwerfen.
  function handleRequestCloseOverview() {
    if (overviewDirty) {
      setConfirmingOverviewClose(true);
    } else {
      setOverviewOpen(false);
    }
  }

  function handleApplyOverviewChanges() {
    if (result && draftPlan) {
      setResult({ ...result, plan: draftPlan });
      setExcludedStationIds(draftExcludedStationIds);
      setForcedStationIdByIndex(draftForcedStationIdByIndex);
    }
    setOverviewOpen(false);
    setConfirmingOverviewClose(false);
  }

  function handleDiscardOverviewChanges() {
    setOverviewOpen(false);
    setConfirmingOverviewClose(false);
  }

  async function handleSaveRoute() {
    if (!result) return;
    setSavingRoute(true);
    setSaveError(null);
    try {
      await saveRoute({
        name: saveRouteName.trim() || defaultSaveRouteName,
        startQuery: start,
        start: result.start,
        endQuery: end,
        end: result.end,
        manualWaypoints: result.manualWaypoints,
        vehicleId,
        caravanId: caravanId || null,
        manualConsumptionKwhPer100km: consumption.trim() ? Number(consumption) : null,
        minPowerKw: minPowerKw.trim() ? Number(minPowerKw) : null,
        preferTrailerSuitable,
        preferredProvider: preferredProvider || null,
        departureSocPercent: departureSoc,
        minSocAtStopPercent: minSocAtStop,
        minSocAtDestinationPercent: minSocAtDestination,
        targetSocAfterChargingPercent: targetSocAfterCharging,
        detourToleranceKm: detourTolerance,
        excludedStationIds,
        forcedStationIdByIndex,
      });
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Route konnte nicht gespeichert werden.");
    } finally {
      setSavingRoute(false);
    }
  }

  // Baut nur die Google-Maps-URL (reiner Adapter-Aufruf, siehe
  // src/lib/providers/navigation) und oeffnet sie -- das Oeffnen selbst
  // (window.open) ist bewusst der einzige web-spezifische Teil, damit eine
  // spaetere native App dieselbe buildUrl()-Logik mit Linking.openURL
  // wiederverwenden kann.
  function handleStartNavigation() {
    if (!result) return;
    const timeline = buildRouteTimeline({
      start: result.start,
      end: result.end,
      distanceKm: result.plan.distanceKm,
      chargingStops: result.plan.chargingStops,
      manualWaypoints: result.manualWaypoints,
    });
    const url = googleMapsNavigationProvider.buildUrl({
      origin: result.start,
      destination: result.end,
      stops: timeline
        .filter((p) => p.kind === "charging" || p.kind === "manual")
        .map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    });
    // Eindeutiger Fenstername statt "_blank": sonst wuerde ein zweiter Klick
    // (z. B. nach Aenderung der Route) denselben bereits offenen Tab nur
    // stillschweigend im Hintergrund umleiten, statt zuverlaessig einen
    // (neuen) Tab zu oeffnen -- die Charge2Camp-App bleibt so immer im
    // urspruenglichen Tab geoeffnet.
    window.open(url, `charge2camp-navigation-${Date.now()}`, "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-8">
      {showSavedRouteLoadingIndicator && <LoadingIndicator text="Gespeicherte Route wird geladen…" />}

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
            setForcedStationIdByIndex({});
            setSaveRouteName("");
            setSaveError(null);
            setSaveSuccess(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Route konnte nicht berechnet werden.");
          } finally {
            setLoading(false);
          }
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={() => setFavoritesDialogOpen(true)}
            className="min-h-11 rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            ♥ Aus Favoriten wählen
          </button>
          {homeAddress && (
            <button
              type="button"
              onClick={() => setHomeDialogOpen(true)}
              className="min-h-11 rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              🏠 Zuhause verwenden
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Start *
          <AddressAutocomplete
            name="start"
            required
            value={start}
            onChange={setStart}
            onSelectCoordinates={setStartCoords}
            placeholder="z. B. München"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
          {startCoords && (
            <>
              <input type="hidden" name="start_latitude" value={startCoords.latitude} />
              <input type="hidden" name="start_longitude" value={startCoords.longitude} />
            </>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Ziel *
          <AddressAutocomplete
            name="end"
            required
            value={end}
            onChange={setEnd}
            placeholder="z. B. Porec, Kroatien"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
            localSuggestions={campsiteSuggestions}
            onSelectCoordinates={setEndCoords}
          />
          {endCoords && (
            <>
              <input type="hidden" name="end_latitude" value={endCoords.latitude} />
              <input type="hidden" name="end_longitude" value={endCoords.longitude} />
            </>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Elektroauto *
          <select
            name="vehicle_id"
            required
            value={vehicleId}
            onChange={(e) => handleVehicleSelect(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Bevorzugter Anbieter (optional)
          <select
            name="preferred_provider"
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Alle Anbieter</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <p className="text-sm font-medium">Manuelle Zwischenstopps (optional)</p>
          <p className="-mt-1 text-xs text-black/40 dark:text-white/40">
            Orte, die die Route zwingend durchfahren soll (z. B. ein Campingplatz oder eine
            Sehenswürdigkeit) -- unabhängig davon, ob dort geladen werden muss.
          </p>
          {manualStopQueries.map((query, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1">
                <AddressAutocomplete
                  name="manual_stop"
                  value={query}
                  onChange={(nextValue) => {
                    const next = [...manualStopQueries];
                    next[index] = nextValue;
                    setManualStopQueries(next);
                  }}
                  placeholder="z. B. Camping Seeblick, Prien am Chiemsee"
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
                />
              </div>
              <button
                type="button"
                onClick={() => setManualStopQueries(manualStopQueries.filter((_, i) => i !== index))}
                aria-label="Zwischenstopp entfernen"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-black/15 text-base hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setManualStopQueries([...manualStopQueries, ""])}
            className="w-fit min-h-11 rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            + Zwischenstopp hinzufügen
          </button>
        </div>

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
            Du hast noch kein Elektroauto im Profil hinterlegt. Bitte zuerst unter{" "}
            <a href="/profil/gespann" className="underline">
              Mein Gespann
            </a>{" "}
            ergänzen.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            disabled={loading || vehicles.length === 0}
            className="min-h-12 rounded-md bg-action px-5 py-3 font-medium text-base hover:bg-action-hover disabled:opacity-50"
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
              className="min-h-12 rounded-md border border-black/15 px-5 py-3 font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              Neue Routenplanung
            </button>
          )}
        </div>

        {showLoadingIndicator && <LoadingIndicator text="Route wird berechnet…" />}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleOpenOverview}
              className="min-h-12 rounded-md border border-route px-4 py-3 text-sm font-medium text-route hover:bg-route/10 "
            >
              Routenübersicht anzeigen
            </button>
            <button
              type="button"
              onClick={handleStartNavigation}
              className="min-h-12 rounded-md bg-action px-4 py-3 text-sm font-medium text-base hover:bg-action-hover"
            >
              Navigation starten (Google Maps)
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Name für &quot;Meine Routen&quot; im Profil
              <input
                value={saveRouteName || defaultSaveRouteName}
                onChange={(e) => {
                  setSaveRouteName(e.target.value);
                  setSaveSuccess(false);
                }}
                className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveRoute}
              disabled={savingRoute}
              className="min-h-12 rounded-md border border-black/15 px-4 py-3 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
            >
              {savingRoute ? "Wird gespeichert…" : "Im Profil speichern"}
            </button>
            {saveSuccess && (
              <p className="w-full text-sm text-route">
                Gespeichert — zu finden unter{" "}
                <a href="/profil/routen" className="underline">
                  Mein Profil → Meine Routen
                </a>
                .
              </p>
            )}
            {saveError && <p className="w-full text-sm text-red-600">{saveError}</p>}
          </div>

          {replanError && <p className="text-sm text-red-600">{replanError}</p>}

          <div className="h-[400px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            <MapView
              markers={[
                { id: "start", latitude: result.start.latitude, longitude: result.start.longitude, label: "Start" },
                { id: "end", latitude: result.end.latitude, longitude: result.end.longitude, label: "Ziel" },
                ...result.plan.chargingStops.map((stop, index) => ({
                  id: `charging-stop-${index}`,
                  latitude: stop.station.latitude,
                  longitude: stop.station.longitude,
                  label: `${index + 1}. Ladestopp: ${stop.station.name ?? stop.station.provider}`,
                  iconSrc: TRAILER_SUITABILITY_ICON_SRC[stop.station.trailer_suitable],
                  popupHtml: buildChargingStopPopupHtml(stop, index),
                })),
                ...result.manualWaypoints.map((waypoint, index) => ({
                  id: `manual-stop-${index}`,
                  latitude: waypoint.latitude,
                  longitude: waypoint.longitude,
                  label: `Zwischenstopp: ${waypoint.displayName}`,
                  color: "#3b82f6",
                })),
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
            {result.plan.totalEstimatedCostEur !== null && (
              <div>
                <p className="text-black/50 dark:text-white/50">Geschätzte Ladekosten</p>
                <p className="text-lg font-semibold">
                  {result.plan.costEstimateIncomplete && "ab "}
                  {result.plan.totalEstimatedCostEur.toFixed(2)} €
                </p>
              </div>
            )}
          </div>

          {result.manualWaypoints.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Manuelle Zwischenstopps</p>
              <ul className="text-sm text-black/70 dark:text-white/70">
                {result.manualWaypoints.map((waypoint) => (
                  <li key={waypoint.query}>
                    {waypoint.displayName} (nach {waypoint.distanceFromStartKm.toFixed(0)} km)
                  </li>
                ))}
              </ul>
            </div>
          )}

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

          {result.roadRestrictions.status === "checked" && result.roadRestrictions.warnings.length > 0 && (
            <p className="rounded-md border border-red-600/30 bg-red-600/5 p-3 text-sm text-red-700 dark:text-red-400">
              ⚠ {result.roadRestrictions.warnings.length}{" "}
              {result.roadRestrictions.warnings.length === 1
                ? "bekannte Straßenrestriktion"
                : "bekannte Straßenrestriktionen"}{" "}
              entlang der Route, die dein Gespann überschreitet — Details in der{" "}
              <button type="button" onClick={() => setOverviewOpen(true)} className="underline">
                Routenübersicht
              </button>
              .
            </p>
          )}

          {result.roadRestrictions.status === "failed" && (
            <p className="rounded-md border border-black/10 bg-black/5 p-3 text-xs text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
              Straßenrestriktionen (Höhe/Breite/Gewicht) konnten nicht geprüft werden — der Dienst war nicht
              erreichbar.
            </p>
          )}

          {!result.plan.chargingStopsRequired ? (
            <p className="rounded-md border border-route/30 bg-route/5 p-3 text-sm text-route">
              Kein Ladestopp nötig — die Strecke liegt innerhalb der Reichweite deines Gespanns.
              {result.plan.arrivalSocPercent !== null &&
                ` Voraussichtlicher Ankunfts-Ladestand: ${result.plan.arrivalSocPercent.toFixed(0)}%.`}
            </p>
          ) : (
            result.plan.chargingStops.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  Geplante Ladestopps ({result.plan.chargingStops.length}) — Details und Alternativen in der{" "}
                  <button
                    type="button"
                    onClick={handleOpenOverview}
                    className="underline hover:no-underline"
                  >
                    Routenübersicht
                  </button>
                </p>
                {result.plan.chargingStops.map((stop, index) => (
                  <div key={stop.station.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                    <p className="font-medium">{index + 1}. Ladestopp</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs text-white"
                        style={{ backgroundColor: TRAILER_SUITABILITY_COLORS[stop.station.trailer_suitable] }}
                      >
                        {TRAILER_SUITABILITY_LABELS[stop.station.trailer_suitable]}
                      </span>
                      <span className="text-sm">{stop.station.name ?? stop.station.provider}</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
                      <li>Nach {stop.distanceFromStartKm.toFixed(0)} km ab Start</li>
                      <li>Umweg von der Route: ca. {stop.corridorDistanceKm.toFixed(0)} km</li>
                      <li>Ladestand bei Ankunft: {stop.socOnArrivalPercent.toFixed(0)}%</li>
                      {stop.chargingTimeMin !== null && (
                        <li>Voraussichtliche Ladezeit: {formatDuration(stop.chargingTimeMin)}</li>
                      )}
                      <li>
                        Geschätzte Ladekosten:{" "}
                        {stop.estimatedCostEur !== null ? `${stop.estimatedCostEur.toFixed(2)} €` : "unbekannt (kein Preis hinterlegt)"}
                      </li>
                      <li>
                        {stop.lastConfirmedAt
                          ? `Zuletzt von der Community bestätigt am ${new Date(stop.lastConfirmedAt).toLocaleDateString("de-DE")}`
                          : "Noch nicht von der Community bestätigt"}
                      </li>
                    </ul>
                  </div>
                ))}
                {result.plan.arrivalSocPercent !== null && (
                  <p className="text-sm text-black/70 dark:text-white/70">
                    Ladestand am Ziel: {result.plan.arrivalSocPercent.toFixed(0)}%
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}

      {result && draftPlan && (
        <RouteOverviewDialog
          open={overviewOpen}
          start={result.start}
          end={result.end}
          manualWaypoints={result.manualWaypoints}
          plan={draftPlan}
          roadRestrictions={result.roadRestrictions}
          busy={replanBusy}
          dirty={overviewDirty}
          confirmingClose={confirmingOverviewClose}
          onRequestClose={handleRequestCloseOverview}
          onApplyChanges={handleApplyOverviewChanges}
          onDiscardChanges={handleDiscardOverviewChanges}
          onCancelClose={() => setConfirmingOverviewClose(false)}
          onDeleteStop={(stopIndex, stationId) => handleDeleteStop(stopIndex, stationId)}
          onSelectAlternative={(stopIndex, stationId) => handleSelectAlternative(stopIndex, stationId)}
        />
      )}

      <FavoritesPickerDialog
        open={favoritesDialogOpen}
        favorites={favorites}
        onClose={() => setFavoritesDialogOpen(false)}
        onPick={(favorite, target) => {
          if (target === "start") {
            setStart(favorite.name);
            setStartCoords({ latitude: favorite.latitude, longitude: favorite.longitude });
          } else {
            setEnd(favorite.name);
            setEndCoords({ latitude: favorite.latitude, longitude: favorite.longitude });
          }
          setFavoritesDialogOpen(false);
        }}
      />

      <HomeAddressPickerDialog
        open={homeDialogOpen}
        homeAddress={homeAddress}
        onClose={() => setHomeDialogOpen(false)}
        onPick={(target) => {
          if (!homeAddress) return;
          if (target === "start") {
            setStart(homeAddress.name);
            setStartCoords({ latitude: homeAddress.latitude, longitude: homeAddress.longitude });
          } else {
            setEnd(homeAddress.name);
            setEndCoords({ latitude: homeAddress.latitude, longitude: homeAddress.longitude });
          }
          setHomeDialogOpen(false);
        }}
      />
    </div>
  );
}
