"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadSavedRoute,
  planRoute,
  replanChargingStop,
  saveRoute,
  type RoutePlanResult,
} from "@/app/routenplaner/actions";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { MapView } from "@/components/map/map-view";
import { RouteOverviewPanel } from "@/components/routing/route-overview-panel";
import { RouteWizardTabs } from "@/components/routing/route-wizard-tabs";
import { FavoritesPickerDialog } from "@/components/routing/favorites-picker-dialog";
import { HomeAddressPickerDialog } from "@/components/routing/home-address-picker-dialog";
import { SavedRoutePickerDialog, type SavedRouteOption } from "@/components/routing/saved-route-picker-dialog";
import { NavigationLink } from "@/components/profile/navigation-link";
import { GespannPanel } from "@/components/gespann-panel";
import {
  DEFAULT_CONSUMPTION_KWH_PER_100KM,
  DEFAULT_DEPARTURE_SOC_PERCENT,
  DEFAULT_DETOUR_TOLERANCE_KM,
  DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT,
  DEFAULT_MIN_SOC_AT_STOP_PERCENT,
  DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT,
  MAX_DETOUR_TOLERANCE_KM,
} from "@/lib/route-planning";
import { buildRouteTimeline } from "@/lib/route-timeline";
import { buildRouteSegments } from "@/lib/route-navigation";
import { TRAILER_PIN_COLORS, TRAILER_PIN_ICON_SRC, TRAILER_PIN_LABELS } from "@/lib/trailer-verdict";
import { CHARGING_PROVIDERS } from "@/lib/charging-providers";
import type { CampsiteDestinationOption } from "@/lib/campsites";
import type { FavoriteDestinationOption } from "@/lib/favorites";
import type { Caravan, Vehicle } from "@/types/database";
import { useDelayedLoading } from "@/lib/use-delayed-loading";
import { FullscreenLoader } from "@/components/fullscreen-loader";

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
// popupHtml) -- dieselben Angaben wie die Ladestopp-Karten in der
// Routenuebersicht (Tab 2), damit man sie nicht erst suchen/scrollen muss,
// um zu sehen, worum es bei einem angetippten Pin geht.
function buildChargingStopPopupHtml(stop: RoutePlanResult["plan"]["chargingStops"][number], index: number): string {
  const name = escapeHtml(stop.station.name ?? stop.station.provider ?? "Ladepunkt");
  const badgeColor = TRAILER_PIN_COLORS[stop.station.trailerPinState];
  const badgeLabel = escapeHtml(TRAILER_PIN_LABELS[stop.station.trailerPinState]);
  const confirmedLine = stop.lastConfirmedAt
    ? `Zuletzt von der Community bestätigt am ${new Date(stop.lastConfirmedAt).toLocaleDateString("de-DE")}`
    : "Noch nicht von der Community bestätigt";

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
        <li>${confirmedLine}</li>
      </ul>
    </div>
  `;
}

type WizardStep = 1 | 2 | 3;

// Zwischenspeicher fuer "Details ansehen" bei einem Ladestopp/einer
// Alternative in Tab 2 (Nutzerwunsch): das volle Ergebnis (inkl. bereits
// berechnetem Ladeplan) landet vor dem Verlassen der Seite in
// sessionStorage, damit der "Zurück zur Routenplanung"-Link auf der
// Ladepunkt-Detailseite (ladepunkte/[id]/page.tsx, ?returnTo=routenplaner)
// die Planung ohne Neuberechnung fortsetzen kann, statt bei Tab 1 neu
// anzufangen. sessionStorage statt der Datenbank, damit dabei NICHT
// versehentlich eine Route unter "Meine Routen" gespeichert wird.
const DRAFT_STORAGE_KEY = "routenplaner:draft";

interface RouteDraftState {
  start: string;
  end: string;
  startCoords: { latitude: number; longitude: number } | null;
  endCoords: { latitude: number; longitude: number } | null;
  manualStopQueries: string[];
  vehicleId: string;
  caravanId: string;
  consumption: string;
  minPowerKw: string;
  preferTrailerSuitable: boolean;
  preferredProviders: string[];
  avoidedProviders: string[];
  departureSoc: number;
  minSocAtStop: number;
  minSocAtDestination: number;
  targetSocAfterCharging: number;
  detourTolerance: number;
  excludedStationIds: string[];
  forcedStationIdByIndex: Record<number, string>;
  result: RoutePlanResult;
}

export function RoutePlannerForm({
  vehicles,
  caravans,
  initialPreferredProviders,
  initialAvoidedProviders,
  campsiteDestinations,
  favorites,
  homeAddress,
  savedRoutes,
  initialVehicleId,
  initialCaravanId,
  initialDestination,
  initialSavedRouteId,
  resumeDraft,
}: {
  vehicles: Vehicle[];
  caravans: Caravan[];
  /** Im Profil ("Mein Gespann") hinterlegte bevorzugte Lade-Anbieter
   * (Schluessel aus charging-providers.ts) -- Vorbelegung fuer den
   * Anbieter-Filter unten, per Nutzerwunsch bereits standardmaessig
   * ausgewaehlt. */
  initialPreferredProviders: string[];
  /** Im Profil hinterlegte vermiedene Lade-Anbieter (Schluessel aus
   * charging-providers.ts) -- Vorbelegung fuer den Anbieter-Filter unten,
   * analog zu initialPreferredProviders. */
  initialAvoidedProviders: string[];
  /** Eigene Campingplaetze (Name + Koordinaten), als zusaetzliche, erkennbare Vorschlaege im Ziel-Feld. */
  campsiteDestinations: CampsiteDestinationOption[];
  /** Vom Nutzer gemerkte Campingplaetze/Ladepunkte, fuer die Favoriten-Auswahl (Start/Ziel). */
  favorites: FavoriteDestinationOption[];
  /** Im Profil ("Meine Daten") hinterlegte Zuhause-Adresse, fuer den "Zuhause verwenden"-Button (Start/Ziel). */
  homeAddress: { name: string; latitude: number; longitude: number } | null;
  /** Eigene gespeicherte Routen ("Meine Routen" im Profil), fuer den "Gespeicherte Route öffnen"-Picker, bevor eine Route berechnet wurde. */
  savedRoutes: SavedRouteOption[];
  /** Vorbelegung fuer die Gespann-Auswahl (zuletzt in einer gespeicherten Route verwendetes bzw. zuletzt im Profil angelegtes Fahrzeug/Wohnwagen, siehe routenplaner/page.tsx) -- leerer String, wenn nichts vorhanden ist. */
  initialVehicleId: string;
  initialCaravanId: string;
  /** Vom "Route hierher planen"-Button auf einer Campingplatz- oder Ladepunkt-Detailseite (?destination_campsite_id=...  /  ?destination_station_id=...) -- befuellt "Ziel" bereits beim ersten Rendern. */
  initialDestination?: { name: string; latitude: number; longitude: number };
  /** Aus dem URL-Query-Parameter `?savedRouteId=...` (Link "Öffnen" im Profil) -- laedt die gespeicherte Route beim ersten Rendern. */
  initialSavedRouteId?: string;
  /** Aus `?resumeDraft=1` -- gesetzt vom "Zurück zur Routenplanung"-Link auf
   * einer Ladepunkt-Detailseite (siehe handleViewStationDetails unten).
   * Stellt den Planungsstand aus sessionStorage wieder her und springt zu
   * Tab 2, statt neu zu beginnen. */
  resumeDraft?: boolean;
}) {
  // Drei-Schritte-Assistent statt einer langen, durchgescrollten Seite
  // (Nutzerwunsch: uebersichtlicher auf dem Handy). Alle Formular-/
  // Ergebnisdaten bleiben unveraendert in diesem einen Client-Component-
  // State -- ein Tab-Wechsel ist nur ein Render-Wechsel (siehe
  // route-wizard-tabs.tsx), kein Verlust irgendeiner Eingabe.
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const router = useRouter();

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
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [caravanId, setCaravanId] = useState(initialCaravanId);
  // Verbrauch aus dem Fahrzeugprofil vorbelegen, wenn die Gespann-Auswahl
  // selbst schon vorbelegt ist (initialVehicleId) -- gleiche Ableitung wie
  // handleVehicleSelect beim manuellen Wechsel des Fahrzeugs.
  const [consumption, setConsumption] = useState(
    vehicles.find((v) => v.id === initialVehicleId)?.consumption_kwh_per_100km?.toString() ?? ""
  );
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
  const [preferredProviders, setPreferredProviders] = useState<string[]>(initialPreferredProviders);
  const [avoidedProviders, setAvoidedProviders] = useState<string[]>(initialAvoidedProviders);
  // Aufklappbar (Nutzerwunsch) -- offen, sobald bereits Anbieter ausgewaehlt
  // sind (z. B. per Profil-Vorbelegung), sonst eingeklappt.
  const [providersOpen, setProvidersOpen] = useState(
    initialPreferredProviders.length > 0 || initialAvoidedProviders.length > 0
  );
  const [manualStopQueries, setManualStopQueries] = useState<string[]>([]);
  const [excludedStationIds, setExcludedStationIds] = useState<string[]>([]);
  const [forcedStationIdByIndex, setForcedStationIdByIndex] = useState<Record<number, string>>({});
  const [replanBusy, setReplanBusy] = useState(false);
  const [replanError, setReplanError] = useState<string | null>(null);
  const [loadingSavedRoute, setLoadingSavedRoute] = useState(Boolean(initialSavedRouteId));
  const showSavedRouteLoadingIndicator = useDelayedLoading(loadingSavedRoute);
  const [savedRouteDialogOpen, setSavedRouteDialogOpen] = useState(false);
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

  const timeline = useMemo(
    () =>
      result
        ? buildRouteTimeline({
            start: result.start,
            end: result.end,
            distanceKm: result.plan.distanceKm,
            chargingStops: result.plan.chargingStops,
            manualWaypoints: result.manualWaypoints,
          })
        : [],
    [result]
  );

  // Laedt eine gespeicherte Route und belegt alle Formularfelder + das
  // Ergebnis damit vor -- gemeinsam genutzt vom Mount-Effect unten
  // (?savedRouteId=... aus dem Link "Öffnen" im Profil) und vom
  // "Gespeicherte Route öffnen"-Picker (siehe savedRouteDialogOpen), bevor
  // eine eigene Route berechnet wurde.
  async function loadAndApplySavedRoute(id: string) {
    setLoadingSavedRoute(true);
    setError(null);
    try {
      const saved = await loadSavedRoute(id);
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
      setPreferredProviders(saved.preferredProviders);
      setAvoidedProviders(saved.avoidedProviders);
      setProvidersOpen(saved.preferredProviders.length > 0 || saved.avoidedProviders.length > 0);
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
      setActiveStep(2);
      setSavedRouteDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gespeicherte Route konnte nicht geladen werden.");
    } finally {
      setLoadingSavedRoute(false);
    }
  }

  // Gespeicherte Route ueber ?savedRouteId=... (Link "Öffnen" im Profil)
  // beim ersten Rendern laden. void Promise.resolve().then(...) statt eines
  // direkten Aufrufs: loadAndApplySavedRoute setzt synchron als ersten
  // Schritt State (setLoadingSavedRoute), was ein Lint-Verbot fuer
  // synchrones setState direkt im Effect-Body ausloest (React rief sonst
  // kaskadierend erneut denselben Render an).
  useEffect(() => {
    if (!initialSavedRouteId) return;
    void Promise.resolve().then(() => loadAndApplySavedRoute(initialSavedRouteId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSavedRouteId]);

  // Planungsstand nach "Details ansehen" (?resumeDraft=1) wiederherstellen,
  // siehe DRAFT_STORAGE_KEY oben und handleViewStationDetails unten. Fehlt
  // der Entwurf (z. B. anderer Browser-Tab, Speicher geleert), bleibt es
  // bei der normalen leeren Tab-1-Ansicht -- kein Fehler noetig.
  function applyDraft(draft: RouteDraftState) {
    setStart(draft.start);
    setEnd(draft.end);
    setStartCoords(draft.startCoords);
    setEndCoords(draft.endCoords);
    setManualStopQueries(draft.manualStopQueries);
    setVehicleId(draft.vehicleId);
    setCaravanId(draft.caravanId);
    setConsumption(draft.consumption);
    setMinPowerKw(draft.minPowerKw);
    setPreferTrailerSuitable(draft.preferTrailerSuitable);
    setPreferredProviders(draft.preferredProviders);
    setAvoidedProviders(draft.avoidedProviders);
    setProvidersOpen(draft.preferredProviders.length > 0 || draft.avoidedProviders.length > 0);
    setDepartureSoc(draft.departureSoc);
    setMinSocAtStop(draft.minSocAtStop);
    setMinSocAtDestination(draft.minSocAtDestination);
    setTargetSocAfterCharging(draft.targetSocAfterCharging);
    setDetourTolerance(draft.detourTolerance);
    setExcludedStationIds(draft.excludedStationIds);
    setForcedStationIdByIndex(draft.forcedStationIdByIndex);
    setResult(draft.result);
    setActiveStep(2);
  }

  useEffect(() => {
    if (!resumeDraft) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as RouteDraftState;
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      void Promise.resolve().then(() => applyDraft(draft));
    } catch {
      // Beschaedigter/veralteter Entwurf -- einfach ignorieren.
    }
  }, [resumeDraft]);

  // Speichert den aktuellen Planungsstand in sessionStorage und oeffnet die
  // Ladepunkt-Detailseite eines Ladestopps/einer Alternative in Tab 2
  // (Nutzerwunsch: bei jeder Lade-Option alle Infos einsehen koennen, mit
  // "Zurück"-Moeglichkeit, um die Planung fortzusetzen -- siehe
  // ladepunkte/[id]/page.tsx "Zurück zur Routenplanung" bei
  // ?returnTo=routenplaner).
  function handleViewStationDetails(stationId: string) {
    if (result) {
      const draft: RouteDraftState = {
        start,
        end,
        startCoords,
        endCoords,
        manualStopQueries,
        vehicleId,
        caravanId,
        consumption,
        minPowerKw,
        preferTrailerSuitable,
        preferredProviders,
        avoidedProviders,
        departureSoc,
        minSocAtStop,
        minSocAtDestination,
        targetSocAfterCharging,
        detourTolerance,
        excludedStationIds,
        forcedStationIdByIndex,
        result,
      };
      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // Speicher voll/nicht verfuegbar -- Detailseite oeffnet trotzdem,
        // nur ohne funktionierenden "Zurück"-Link.
      }
    }
    router.push(`/ladepunkte/${stationId}?returnTo=routenplaner`);
  }

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
    setPreferredProviders(initialPreferredProviders);
    setAvoidedProviders(initialAvoidedProviders);
    setProvidersOpen(initialPreferredProviders.length > 0 || initialAvoidedProviders.length > 0);
    setDepartureSoc(DEFAULT_DEPARTURE_SOC_PERCENT);
    setMinSocAtStop(DEFAULT_MIN_SOC_AT_STOP_PERCENT);
    setMinSocAtDestination(DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT);
    setTargetSocAfterCharging(DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT);
    setDetourTolerance(DEFAULT_DETOUR_TOLERANCE_KM);
    setExcludedStationIds([]);
    setForcedStationIdByIndex({});
    setReplanError(null);
    setSaveRouteName("");
    setSaveError(null);
    setSaveSuccess(false);
    setActiveStep(1);
  }

  // Erzwungene Alternativen-Wahlen ab (ausschliesslich) diesem Stopp-Index
  // verwerfen -- sie haengen von der Position des geaenderten Stopps ab und
  // werden nach der Aenderung frei neu bestimmt.
  function clearForcedFrom(stopIndex: number): Record<number, string> {
    const next: Record<number, string> = {};
    for (const [key, value] of Object.entries(forcedStationIdByIndex)) {
      if (Number(key) < stopIndex) next[Number(key)] = value;
    }
    return next;
  }

  // Ruft die Ladeplanung neu ab, ohne Start/Ziel neu zu geocodieren oder die
  // Route neu zu berechnen (Streckengeometrie bleibt gleich) -- genutzt zum
  // Loeschen eines vorgeschlagenen Ladestopps oder Waehlen einer Alternative
  // in der Routenuebersicht (Tab 2). Wirkt bewusst SOFORT auf `result`, ohne
  // Entwurfs-/Uebernehmen-Schritt (siehe route-overview-panel.tsx).
  async function handleReplan(overrides: {
    excludedStationIds?: string[];
    forcedStationIdByIndex?: Record<number, string>;
  }) {
    if (!result) return;
    setReplanBusy(true);
    setReplanError(null);
    try {
      const nextExcluded = overrides.excludedStationIds ?? excludedStationIds;
      const nextForced = overrides.forcedStationIdByIndex ?? forcedStationIdByIndex;
      const newPlan = await replanChargingStop({
        vehicleId,
        caravanId: caravanId || undefined,
        route: { distanceKm: result.plan.distanceKm, durationMin: result.plan.durationMin, geometry: result.geometry },
        consumptionKwhPer100km: result.plan.effectiveConsumptionKwhPer100km,
        preferTrailerSuitable,
        minPowerKw: minPowerKw ? Number(minPowerKw) : undefined,
        preferredProviders,
        avoidedProviders,
        departureSocPercent: departureSoc,
        minSocAtStopPercent: minSocAtStop,
        minSocAtDestinationPercent: minSocAtDestination,
        targetSocAfterChargingPercent: targetSocAfterCharging,
        detourToleranceKm: detourTolerance,
        excludedStationIds: nextExcluded,
        forcedStationIdByIndex: nextForced,
      });
      setResult({ ...result, plan: newPlan });
      setExcludedStationIds(nextExcluded);
      setForcedStationIdByIndex(nextForced);
    } catch (err) {
      setReplanError(err instanceof Error ? err.message : "Ladestopp konnte nicht neu geplant werden.");
    } finally {
      setReplanBusy(false);
    }
  }

  function handleDeleteStop(stopIndex: number, stationId: string) {
    handleReplan({
      excludedStationIds: [...excludedStationIds, stationId],
      forcedStationIdByIndex: clearForcedFrom(stopIndex),
    });
  }

  function handleSelectAlternative(stopIndex: number, stationId: string) {
    handleReplan({
      forcedStationIdByIndex: { ...clearForcedFrom(stopIndex), [stopIndex]: stationId },
    });
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
        preferredProviders,
        avoidedProviders,
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

  // Google-Maps-URLs (Gesamtroute + pro Etappe) -- gleiche Logik wie "Meine
  // Routen" (siehe src/lib/route-navigation.ts), damit beide Stellen exakt
  // dieselben Links bauen. window.open passiert im wiederverwendbaren
  // NavigationLink (src/components/profile/navigation-link.tsx); eine
  // spaetere native App wuerde dort Linking.openURL() einsetzen, die
  // buildUrl()-Logik bliebe unveraendert.
  const routeSegments = useMemo(() => (result ? buildRouteSegments(result) : null), [result]);

  return (
    <div className="flex flex-col gap-6">
      <RouteWizardTabs activeStep={activeStep} reachable={Boolean(result)} onSelectStep={setActiveStep} />

      {/* Direkt unter der Tab-Leiste, auf allen drei Tabs sichtbar
          (Nutzerwunsch): vor der ersten Berechnung ein Einstieg ueber eine
          bereits gespeicherte Route statt neu anzufangen; sobald eine Route
          berechnet ist, stattdessen "Neue Routenplanung" (verwirft die
          aktuelle Route komplett -- fuer Anpassungen an der bestehenden
          Route gibt es stattdessen "← Daten anpassen" in Tab 2). */}
      {result ? (
        <button
          type="button"
          onClick={handleNewPlanning}
          className="min-h-11 w-fit rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Neue Routenplanung
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSavedRouteDialogOpen(true)}
          className="min-h-11 w-fit rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          Gespeicherte Route öffnen
        </button>
      )}

      {showSavedRouteLoadingIndicator && <FullscreenLoader text="Gespeicherte Route wird geladen…" />}

      {/* ---------- Tab 1: Angaben ---------- */}
      {activeStep === 1 && (
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
              // Nutzerwunsch: nach dem Berechnen direkt zur Routenuebersicht
              // springen, statt auf derselben Seite nach unten scrollen zu
              // muessen.
              setActiveStep(2);
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

          {/* Gespann-Auswahl (Nutzerwunsch: uebersichtlicher, eigener
              Block statt zweier gleichrangiger Felder mitten im Formular)
              -- gleiche Box wie oben auf profil/gespann, siehe
              gespann-panel.tsx. Hier steuert die Auswahl direkt die
              Routenplanung (kein persistentes Speichern). Ueberschrift
              AUSSERHALB der Box, in der gleichen Schriftart wie die
              anderen Feld-Titel (Start, Ziel, Verbrauch, ...). */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <p className="text-sm">Mein Gespann</p>
            <GespannPanel
              vehicles={vehicles}
              caravans={caravans}
              vehicleId={vehicleId}
              caravanId={caravanId}
              onVehicleChange={handleVehicleSelect}
              onCaravanChange={setCaravanId}
              vehicleRequired
            />
          </div>

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

          <div className="text-sm sm:col-span-2">
            <button
              type="button"
              onClick={() => setProvidersOpen((o) => !o)}
              className="flex min-h-11 w-full items-center justify-between rounded-md border border-black/15 px-3 py-2 text-left font-medium dark:border-white/15"
            >
              <span>
                Anbieter priorisieren oder ausschließen (optional)
                {preferredProviders.length > 0 && ` -- ${preferredProviders.length}× bevorzugt`}
                {avoidedProviders.length > 0 && ` -- ${avoidedProviders.length}× vermieden`}
              </span>
              <span aria-hidden="true">{providersOpen ? "▲" : "▼"}</span>
            </button>

            {providersOpen && (
              <div className="mt-2 rounded-md border border-black/15 p-3 dark:border-white/15">
                {(initialPreferredProviders.length > 0 || initialAvoidedProviders.length > 0) && (
                  <p className="mb-2 text-xs text-black/50 dark:text-white/50">
                    Vorausgewählt aus deinem Profil (&quot;Mein Gespann&quot;) -- du kannst die Auswahl hier für
                    diese Route anpassen. Vermiedene Anbieter werden nie als Ladestopp vorgeschlagen.
                  </p>
                )}
                <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                  {CHARGING_PROVIDERS.map((p) => (
                    <div key={p.key} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-sm">{p.label}</span>
                      <div className="flex shrink-0 gap-3">
                        <label className="flex min-h-11 items-center gap-1.5 text-sm text-route">
                          <input
                            type="checkbox"
                            name="preferred_providers"
                            value={p.key}
                            checked={preferredProviders.includes(p.key)}
                            onChange={() => {
                              setPreferredProviders((prev) =>
                                prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]
                              );
                              setAvoidedProviders((prev) => prev.filter((k) => k !== p.key));
                            }}
                          />
                          Bevorzugen
                        </label>
                        <label className="flex min-h-11 items-center gap-1.5 text-sm text-red-600">
                          <input
                            type="checkbox"
                            name="avoided_providers"
                            value={p.key}
                            checked={avoidedProviders.includes(p.key)}
                            onChange={() => {
                              setAvoidedProviders((prev) =>
                                prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]
                              );
                              setPreferredProviders((prev) => prev.filter((k) => k !== p.key));
                            }}
                          />
                          Vermeiden
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="prefer_trailer_suitable"
                value="1"
                checked={preferTrailerSuitable}
                onChange={(e) => setPreferTrailerSuitable(e.target.checked)}
              />
              Anhängertaugliche Ladepunkte bevorzugen
            </label>
          </div>

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
          </div>

          {showLoadingIndicator && <FullscreenLoader text="Route wird berechnet…" />}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {/* ---------- Tab 2: Routenübersicht ---------- */}
      {activeStep === 2 && result && (
        <div className="flex flex-col gap-6">
          <div className="h-[350px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
            <MapView
              markers={[
                { id: "start", latitude: result.start.latitude, longitude: result.start.longitude, label: "Start" },
                { id: "end", latitude: result.end.latitude, longitude: result.end.longitude, label: "Ziel" },
                ...result.plan.chargingStops.map((stop, index) => ({
                  id: `charging-stop-${index}`,
                  latitude: stop.station.latitude,
                  longitude: stop.station.longitude,
                  label: `${index + 1}. Ladestopp: ${stop.station.name ?? stop.station.provider}`,
                  iconSrc: TRAILER_PIN_ICON_SRC[stop.station.trailerPinState],
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
              route={result.mapGeometry}
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

          {replanError && <p className="text-sm text-red-600">{replanError}</p>}

          {!result.plan.chargingStopsRequired && result.manualWaypoints.length === 0 ? (
            <p className="rounded-md border border-route/30 bg-route/5 p-3 text-sm text-route">
              Kein Ladestopp nötig — die Strecke liegt innerhalb der Reichweite deines Gespanns.
              {result.plan.arrivalSocPercent !== null &&
                ` Voraussichtlicher Ankunfts-Ladestand: ${result.plan.arrivalSocPercent.toFixed(0)}%.`}
            </p>
          ) : (
            <RouteOverviewPanel
              start={result.start}
              end={result.end}
              manualWaypoints={result.manualWaypoints}
              plan={result.plan}
              busy={replanBusy}
              onDeleteStop={handleDeleteStop}
              onSelectAlternative={handleSelectAlternative}
              onViewDetails={handleViewStationDetails}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="min-h-12 rounded-md border border-black/15 px-5 py-3 font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
            >
              ← Daten anpassen
            </button>
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="min-h-12 flex-1 rounded-md bg-action px-5 py-3 font-medium text-base hover:bg-action-hover sm:flex-none"
            >
              Route finalisieren →
            </button>
          </div>
        </div>
      )}

      {/* ---------- Tab 3: Fertig ---------- */}
      {activeStep === 3 && result && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-black/50 dark:text-white/50">Strecke</p>
              <p className="text-lg font-semibold">{result.plan.distanceKm.toFixed(0)} km</p>
            </div>
            <div>
              <p className="text-black/50 dark:text-white/50">Fahrzeit</p>
              <p className="text-lg font-semibold">{formatDuration(result.plan.durationMin)}</p>
            </div>
          </div>

          <ol className="flex flex-col gap-1.5">
            {timeline.map((point, i) => (
              <li key={`${point.kind}-${point.distanceFromStartKm}-${i}`}>
                {i > 0 && (
                  <p className="pl-1 text-xs text-black/40 dark:text-white/40">
                    ↓ {(point.distanceFromStartKm - timeline[i - 1].distanceFromStartKm).toFixed(0)} km
                  </p>
                )}
                <div
                  className={`mt-1 rounded-md border px-3 py-2 text-sm ${
                    point.kind === "start" || point.kind === "end"
                      ? "border-route/30 bg-route/5"
                      : point.kind === "manual"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-black/10 dark:border-white/10"
                  }`}
                >
                  <p className="font-medium">
                    {point.kind === "start" && `Start: ${result.start.displayName}`}
                    {point.kind === "end" && `Ziel: ${result.end.displayName}`}
                    {point.kind === "manual" && `Zwischenstopp: ${point.label}`}
                    {point.kind === "charging" &&
                      `${point.label}: ${point.chargingStop?.station.name ?? point.chargingStop?.station.provider}`}
                  </p>
                  {point.kind === "charging" && point.chargingStop && (
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {point.chargingStop.station.power_kw ? `${point.chargingStop.station.power_kw} kW` : "Leistung unbekannt"}
                      {point.chargingStop.chargingTimeMin !== null &&
                        ` · ca. ${formatDuration(point.chargingStop.chargingTimeMin)} laden`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

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

          {routeSegments && (
            <div className="flex flex-col gap-2">
              <NavigationLink
                href={routeSegments.fullRouteUrl}
                className="min-h-12 w-fit rounded-md bg-action px-5 py-3 text-sm font-medium text-base hover:bg-action-hover"
              >
                Gesamte Route navigieren (Google Maps)
              </NavigationLink>
              {routeSegments.segments.length > 1 && (
                <div>
                  <p className="text-xs text-black/50 dark:text-white/50">Oder nur eine einzelne Etappe navigieren:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {routeSegments.segments.map((segment) => (
                      <NavigationLink
                        key={segment.label}
                        href={segment.url}
                        className="min-h-11 rounded-md border border-black/15 px-3 py-2.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                      >
                        {segment.label}
                      </NavigationLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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

      <SavedRoutePickerDialog
        open={savedRouteDialogOpen}
        savedRoutes={savedRoutes}
        busy={loadingSavedRoute}
        onClose={() => setSavedRouteDialogOpen(false)}
        onPick={loadAndApplySavedRoute}
      />
    </div>
  );
}
