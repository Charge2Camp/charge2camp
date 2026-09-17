"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MapView, type MapBoundsBox } from "@/components/map/map-view";
import {
  TRAILER_PIN_COLORS,
  TRAILER_PIN_ICON_SRC,
  TRAILER_PIN_LABELS,
  getTrailerPinState,
  getReviewState,
  REVIEW_STATE_COLORS,
  REVIEW_STATE_LABELS,
} from "@/lib/trailer-verdict";
import { ReviewStateBadge } from "@/components/charging-stations/review-state-badge";
import { StationBottomSheet } from "@/components/charging-stations/station-bottom-sheet";
import { formatConnectorStandard } from "@/lib/connector-standard";
import { distanceKm } from "@/lib/geo";
import { saveListNavigationContext } from "@/components/list-navigation";
import { loadSavedMapViewport, saveMapViewport, type MapViewport } from "@/lib/map-viewport-storage";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ChargingStationFilters, ChargingStationView } from "@/lib/charging-stations";

// Karte + "pointer: coarse" statt nur der Tailwind-md-Breakpoint-Grenze
// (anders als Header/Bottom-Tab-Bar, siehe site-header.tsx): ein gedrehtes
// Handy ueberschreitet in Querformat oft 767px CSS-Breite (z. B. iPhone 14
// Pro: 852px) -- ohne die pointer-Abfrage wuerde die Karte beim Drehen
// mitten in der Nutzung ins Desktop-Popup-Verhalten zurueckfallen.
const TOUCH_MAP_QUERY = "(max-width: 767px), (pointer: coarse)";

const LIST_NAV_STORAGE_KEY = "ladepunkte:list-nav";
const MAP_VIEWPORT_STORAGE_KEY = "ladepunkte:map-viewport";
const VIEWPORT_FETCH_DEBOUNCE_MS = 500;

// Deutschland-weiter Standard-Ausschnitt fuer die initiale Kartenzentrierung
// ohne hinterlegte Zuhause-Adresse (Nutzerwunsch) -- entspricht MapView's
// eigenem fallbackCenter/fallbackZoom, hier aber explizit gesetzt, damit
// NIE der erste (alphabetisch zufaellig wirkende) Marker der Erstansicht
// als Kartenmittelpunkt herangezogen wird (MapView faellt ohne explizites
// `initialCenter` sonst auf `markers[0]` zurueck).
const GERMANY_OVERVIEW_CENTER = { latitude: 51.1657, longitude: 10.4515 };
const GERMANY_OVERVIEW_ZOOM = 4.5;

/** Baut die Query-Parameter fuer /api/charge-points/viewport aus denselben
 * Filtern, die auch der initiale Seitenaufruf verwendet (siehe
 * parseChargingStationFilters) -- Karte und Server-Erstansicht liefern so
 * bei gleichen Filtern immer dieselben Ergebnisse. */
function buildViewportQuery(filters: ChargingStationFilters, bounds: MapBoundsBox): string {
  const params = new URLSearchParams();
  params.set("bbox", `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`);
  // Markiert die Anfrage als "expliziter Filterzustand" (siehe
  // resolveFastChargersOnly in charging-stations.ts) -- ohne das wuerde ein
  // bewusst abgewaehltes "Nur Schnelllader" beim naechsten Kartenschwenk
  // wieder auf den Default zurueckspringen, weil fast dann fehlt.
  params.set("filters_submitted", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.fastChargersOnly) params.set("fast", "1");
  if (filters.connectorType) params.set("connector", filters.connectorType);
  for (const v of filters.trailerVerdict) params.set(`trailer_${v}`, "1");
  for (const op of filters.operators) params.append("operator", op);
  return params.toString();
}

const PAGE_SIZE = 30;

type SortOption = "name_asc" | "name_desc" | "power_desc" | "power_asc" | "distance";

const SORT_LABELS: Record<SortOption, string> = {
  name_asc: "Name (A–Z)",
  name_desc: "Name (Z–A)",
  power_desc: "Ladeleistung (hoch–niedrig)",
  power_asc: "Ladeleistung (niedrig–hoch)",
  distance: "Entfernung zum Standort",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Pop-up beim Antippen eines Kartenpins -- Kurzinfo direkt auf der Karte
 * (Nutzerwunsch), mit Link zur vollen Detailseite statt sofort dorthin zu
 * navigieren. Rohes HTML statt React/Tailwind, da MapLibre-Popups per
 * `setHTML` befuellt werden (siehe MapView), gleiches Muster wie
 * buildNearbyChargePointPopupHtml auf der Campingplatz-Detailseite. */
function buildStationPopupHtml(station: ChargingStationView): string {
  const name = escapeHtml(station.name ?? station.operator ?? "Ladepunkt");
  const pinState = getTrailerPinState(station.trailer);
  const reviewState = getReviewState(station.trailer?.origin);
  const connectorSummary = Array.from(new Set(station.connectors.map((c) => formatConnectorStandard(c.standard)))).join(
    ", "
  );

  return `
    <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5; max-width: 240px;">
      <p style="margin: 0 0 6px; font-weight: 600;">${name}</p>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 11px; background: ${TRAILER_PIN_COLORS[pinState]};">${escapeHtml(TRAILER_PIN_LABELS[pinState])}</span>
        <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 11px; background: ${REVIEW_STATE_COLORS[reviewState]};">${escapeHtml(REVIEW_STATE_LABELS[reviewState])}</span>
      </div>
      <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; opacity: 0.85;">
        ${station.max_power_kw ? `<li>${station.max_power_kw} kW</li>` : ""}
        ${connectorSummary ? `<li>${escapeHtml(connectorSummary)}</li>` : ""}
        ${!station.is_operational ? `<li style="color: #B4443A;">Laut Quelle nicht betriebsbereit</li>` : ""}
      </ul>
      <a href="/ladepunkte/${station.id}" style="display: inline-block; margin-top: 8px; color: #1D9E75; font-weight: 500;">Zur Ladestation →</a>
    </div>
  `;
}

function OperationalBadge({ isOperational }: { isOperational: boolean }) {
  if (isOperational) return null;
  return (
    <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
      Laut Quelle nicht betriebsbereit
    </span>
  );
}

function ChargingStationCard({
  station,
  selected,
  onHover,
  allIds,
}: {
  station: ChargingStationView;
  selected: boolean;
  onHover: (id: string | null) => void;
  /** Alle IDs der aktuellen Listenansicht in Anzeigereihenfolge --
   * gespeichert beim Antippen (Nutzerwunsch: von der Detailseite zum
   * naechsten Ergebnis springen oder zur Liste zurueck koennen, siehe
   * list-navigation.tsx). */
  allIds: string[];
}) {
  const pinState = getTrailerPinState(station.trailer);
  const connectorSummary = Array.from(new Set(station.connectors.map((c) => formatConnectorStandard(c.standard)))).join(
    ", "
  );

  return (
    <Link
      href={`/ladepunkte/${station.id}`}
      onClick={() => saveListNavigationContext(LIST_NAV_STORAGE_KEY, allIds)}
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
      className={`block rounded-lg border p-4 transition-colors ${
        selected
          ? "border-route bg-route/5"
          : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{station.name ?? station.operator}</p>
          <p className="text-sm text-black/60 dark:text-white/60">{station.operator}</p>
        </div>
        <OperationalBadge isOperational={station.is_operational} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span
          className="rounded-full px-2 py-0.5 text-white"
          style={{ backgroundColor: TRAILER_PIN_COLORS[pinState] }}
        >
          {TRAILER_PIN_LABELS[pinState]}
        </span>
        <ReviewStateBadge origin={station.trailer?.origin} />
        {station.max_power_kw && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
            {station.max_power_kw} kW
          </span>
        )}
        {connectorSummary && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
            {connectorSummary}
          </span>
        )}
      </div>

      {station.trailer?.notes && (
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">{station.trailer.notes}</p>
      )}
    </Link>
  );
}

/** "Ladepunkte"-Seite bewusst kartenzentriert (Nutzerwunsch): beim Oeffnen
 * steht die Karte im Fokus, damit man sich beim Reiseplanen erstmal einen
 * Ueberblick ueber ALLE passenden Ladepunkte verschaffen kann, bevor man
 * gezielt filtert oder in die Liste wechselt -- Filter liegen deshalb nicht
 * mehr als Formular ueber der Seite, sondern als Panel (Sidebar auf Desktop,
 * Bottom-Sheet auf Mobile), das ueber der Karte eingeblendet wird, ohne sie
 * zu verdraengen. */
export function ChargingStationMapExplorer({
  initialStations,
  filters,
  homeAddress,
  emptyMessage,
  filterPanel,
  activeFilterCount,
  isLoggedIn,
}: {
  /** Serverseitig geladene Erstansicht -- fuer den ersten Render, bevor die
   * Karte ihren tatsaechlichen Kartenausschnitt kennt (siehe
   * onBoundsChange unten). Bei aktivem "Nur Favoriten"-Filter bleibt das
   * dauerhaft die einzige Datenquelle (kein Nachladen per Kartenausschnitt
   * -- die Favoritenliste ist ohnehin schon vollstaendig und meist klein). */
  initialStations: ChargingStationView[];
  /** Dieselben Filter, mit denen `initialStations` serverseitig geladen
   * wurde -- Grundlage fuer die Kartenausschnitt-Nachladung
   * (/api/charge-points/viewport), damit Karte und Erstansicht bei
   * gleichen Filtern immer dieselben Treffer liefern. */
  filters: ChargingStationFilters;
  /** Im Profil ("Meine Daten") hinterlegte Zuhause-Adresse -- Grundlage
   * fuer die initiale Kartenzentrierung (Nutzerwunsch), statt des
   * alphabetisch ersten Ladepunkts der Erstansicht. Ohne hinterlegte
   * Adresse startet die Karte stattdessen auf dem Deutschland-weiten
   * Standard-Ausschnitt (siehe MapView fallbackCenter). */
  homeAddress: { latitude: number; longitude: number } | null;
  /** Text, wenn `stations` leer ist. */
  emptyMessage: string;
  /** Formularfelder (Quick-Filter + "weitere Filter"), inkl. Submit/Reset --
   * das umschliessende <form action="/ladepunkte"> liegt direkt hier in der
   * Komponente (siehe filterOpen-Panel unten), NICHT mehr in ladepunkte/
   * page.tsx -- sonst waere auch das Bewertungsformular im Bottom-Sheet
   * ungueltig darin verschachtelt gewesen. */
  filterPanel: ReactNode;
  activeFilterCount: number;
  /** Fuer das Bottom-Sheet der mobilen Kartenansicht (Favorit-Button/
   * Bewertungsformular/Blockieren nur fuer angemeldete Nutzer, siehe
   * StationBottomSheet). */
  isLoggedIn: boolean;
}) {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  function handleViewportChange(viewport: MapViewport) {
    saveMapViewport(MAP_VIEWPORT_STORAGE_KEY, viewport);
  }
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Mobil/Touch bekommt eine eigene Vollbild-Karte + Bottom-Sheet statt der
  // Desktop-Box mit MapLibre-Popup (siehe TOUCH_MAP_QUERY oben).
  const isTouchMap = useMediaQuery(TOUCH_MAP_QUERY);

  // Angetippte Station fuers Bottom-Sheet: `selectedStationSnapshot` haelt
  // bewusst eine EIGENE Kopie statt live aus `stations` nachzuschlagen --
  // `stations` wird bei jedem Kartenschwenk per handleBoundsChange komplett
  // ersetzt, ohne eigenen Snapshot wuerde die Station dem offenen Sheet
  // dann unter der Hand verschwinden.
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedStationSnapshot, setSelectedStationSnapshot] = useState<ChargingStationView | null>(null);

  // Ohne Filter kann die Liste 1000+ Eintraege umfassen (siehe ladepunkte/
  // page.tsx) -- auf einmal ins DOM gerendert waere das spuerbar langsam,
  // deshalb wie bei den Campingplaetzen/Ladepunkten-Listen zuvor
  // schrittweise wachsend statt paginiert.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [sortOption, setSortOption] = useState<SortOption>("name_asc");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Kartenausschnitt-basiertes Nachladen (Nutzerfeedback: ohne Filter
  // schnitt die Erstansicht rein alphabetisch nach Name bei den ersten
  // 1500 von ueber 18.000 Ladepunkten ab -- Namen ab ungefaehr "S" waren
  // beim reinen Kartenbrowsen dadurch NIE sichtbar, unabhaengig vom
  // Kartenausschnitt, z. B. "SHELL FAST BRENNERSTRASSE 245"). `stations`
  // ersetzt `initialStations` sobald der erste Kartenausschnitt bekannt
  // ist (kurz nach dem Laden der Karte) und danach bei jedem Schwenken/
  // Zoomen -- ausser im "Nur Favoriten"-Filter, der bewusst unveraendert
  // bleibt (siehe oben).
  const [stations, setStations] = useState<ChargingStationView[]>(initialStations);
  const [isFetchingViewport, setIsFetchingViewport] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeqRef = useRef(0);

  function selectStation(id: string | null) {
    setSelectedStationId(id);
    setSelectedStationSnapshot(id ? (stations.find((s) => s.id === id) ?? null) : null);
  }

  useEffect(() => {
    void Promise.resolve().then(() => setStations(initialStations));
  }, [initialStations]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    []
  );

  function handleBoundsChange(bounds: MapBoundsBox) {
    if (filters.favoritesOnly) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++fetchSeqRef.current;
      setIsFetchingViewport(true);
      try {
        const qs = buildViewportQuery(filters, bounds);
        const res = await fetch(`/api/charge-points/viewport?${qs}`);
        if (!res.ok) return;
        const data = (await res.json()) as { stations?: ChargingStationView[] };
        // Veraltete Antwort (z. B. wenn der Nutzer waehrend des Requests
        // weitergeschwenkt hat) verwerfen, sonst ueberschreibt eine
        // langsame, alte Antwort ein bereits aktuelleres Ergebnis.
        if (seq !== fetchSeqRef.current) return;
        setStations(data.stations ?? []);
      } catch {
        // Netzwerkfehler: Karte behaelt die zuletzt bekannten Marker statt abzustuerzen.
      } finally {
        if (seq === fetchSeqRef.current) setIsFetchingViewport(false);
      }
    }, VIEWPORT_FETCH_DEBOUNCE_MS);
  }

  const stationCountLabel = stations.length >= 5000 ? `${stations.length}+` : `${stations.length}`;

  function handleSortChange(next: SortOption) {
    setSortOption(next);
    setVisibleCount(PAGE_SIZE);
    if (next === "distance" && !userLocation && !locationLoading) {
      if (!navigator.geolocation) {
        setLocationError("Standortbestimmung wird von diesem Gerät nicht unterstützt.");
        return;
      }
      setLocationLoading(true);
      setLocationError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          setLocationError("Standort konnte nicht ermittelt werden -- Berechtigung erteilt?");
          setLocationLoading(false);
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    }
  }

  const sortedStations = useMemo(() => {
    const list = [...stations];
    switch (sortOption) {
      case "name_asc":
        return list.sort((a, b) => (a.name ?? a.operator ?? "").localeCompare(b.name ?? b.operator ?? ""));
      case "name_desc":
        return list.sort((a, b) => (b.name ?? b.operator ?? "").localeCompare(a.name ?? a.operator ?? ""));
      case "power_desc":
        return list.sort((a, b) => (b.max_power_kw ?? 0) - (a.max_power_kw ?? 0));
      case "power_asc":
        return list.sort((a, b) => (a.max_power_kw ?? 0) - (b.max_power_kw ?? 0));
      case "distance":
        if (!userLocation) return list;
        return list.sort(
          (a, b) =>
            distanceKm(userLocation, { latitude: a.lat, longitude: a.lon }) -
            distanceKm(userLocation, { latitude: b.lat, longitude: b.lon })
        );
      default:
        return list;
    }
  }, [stations, sortOption, userLocation]);
  const sortedStationIds = useMemo(() => sortedStations.map((s) => s.id), [sortedStations]);

  // Memoisiert, sonst entsteht bei jedem Render (z. B. onMarkerClick ->
  // setHoveredId) ein neues Array mit neuen Objektreferenzen -- MapView
  // erkennt das als "Marker haben sich geaendert", raeumt alle Marker
  // (inkl. gerade geoeffnetem Pop-up) ab und berechnet fitBounds neu, die
  // Karte springt dadurch beim Antippen eines Pins sofort zurueck auf die
  // Gesamtansicht, noch bevor das Pop-up sichtbar wird.
  const markers = useMemo(
    () =>
      stations.map((s) => ({
        id: s.id,
        latitude: s.lat,
        longitude: s.lon,
        label: s.name ?? s.operator ?? "",
        iconSrc: TRAILER_PIN_ICON_SRC[getTrailerPinState(s.trailer)],
        // Mobil/Touch uebernimmt das eigene Bottom-Sheet die Kurzinfo (siehe
        // selectStation/StationBottomSheet weiter unten) -- das native
        // MapLibre-Popup bleibt dem Desktop vorbehalten (dort unveraendert).
        popupHtml: isTouchMap ? undefined : buildStationPopupHtml(s),
      })),
    [stations, isTouchMap]
  );

  // Wird beim (Wieder-)Mounten von MapView ausgewertet (Kartenansicht
  // aktivieren/Rueckkehr von der Detailseite) -- kein useMemo, da absichtlich
  // bei jedem Render frisch aus sessionStorage gelesen wird, damit ein
  // zwischenzeitlich (waehrend der Listenansicht) veraenderter Ausschnitt
  // beim naechsten Kartenmount beruecksichtigt wird; nach dem Mount selbst
  // ignoriert MapView Aenderungen an initialCenter/initialZoom ohnehin.
  const savedViewport = loadSavedMapViewport(MAP_VIEWPORT_STORAGE_KEY);

  const FilterButton = (
    <button
      type="button"
      onClick={() => {
        setFilterOpen(true);
        // Zwei uebereinanderliegende Bottom-Sheets (Filter + Stations-Sheet)
        // vermeiden.
        selectStation(null);
      }}
      className="flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-4 text-sm font-medium shadow-md hover:bg-white dark:bg-neutral-900/95 dark:hover:bg-neutral-900"
    >
      Filter
      {activeFilterCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-route px-1 text-xs text-white">
          {activeFilterCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="relative md:mt-6">
      {viewMode === "map" ? (
        <>
          {/* bottom-Wert muss exakt der tatsaechlichen Bottom-Tab-Bar-Hoehe
              entsprechen (4rem + var(--safe-bottom), siehe
              bottom-tab-bar-client.tsx/layout.tsx) -- ein fixer bottom-16
              (nur 4rem, ohne Safe-Area) liess die Karte in der als
              Home-Screen-App gestarteten Standalone-Ansicht (dort waechst
              die Tab-Bar um den Home-Indicator-Abstand) am unteren Rand
              hinter der Bar verschwinden, in der normalen Mobile-Browser-
              Ansicht dagegen nicht (Nutzerfeedback). */}
          <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+var(--safe-bottom))] overflow-hidden md:relative md:inset-auto md:h-[75vh] md:min-h-[420px] md:rounded-xl md:border md:border-black/10 md:dark:border-white/10">
          {/* Mobil/Touch: onMarkerClick+selectedId oeffnen das eigene
              Bottom-Sheet statt des MapLibre-Popups (siehe isTouchMap oben).
              Der ausgewaehlte Pin wird dadurch nebenbei groesser statt
              andersfarbig hervorgehoben (docs/design/brand-guide.md
              Abschnitt 7). Desktop bleibt bewusst OHNE selectedId/
              onMarkerClick: es gibt dort keine gleichzeitig sichtbare Liste,
              deren Eintrag beim Antippen eines Pins hervorgehoben werden
              muesste, und jede Aenderung von selectedId loest in MapView ein
              komplettes Neu-Rendern aller Marker + fitBounds aus (siehe
              dortiger useEffect) -- das wuerde bei jedem Antippen eines Pins
              sofort das gerade geoeffnete Pop-up zerstoeren und die Karte auf
              die Gesamtansicht zuruecksetzen, noch bevor das Pop-up sichtbar
              wird. */}
          <MapView
            markers={markers}
            cluster
            onBoundsChange={handleBoundsChange}
            onViewportChange={handleViewportChange}
            onMarkerClick={isTouchMap ? selectStation : undefined}
            selectedId={isTouchMap ? (selectedStationId ?? undefined) : undefined}
            fitBoundsOnMarkersChange={filters.favoritesOnly}
            initialCenter={savedViewport ?? homeAddress ?? GERMANY_OVERVIEW_CENTER}
            initialZoom={savedViewport?.zoom ?? (homeAddress ? 10 : GERMANY_OVERVIEW_ZOOM)}
          />

          {/* z-30 (nicht z-10): muss ueber den Kartenmarkern (z-20, siehe
              map-view.tsx) liegen, sonst koennen Marker "Trefferzahl"/
              "Filter"/"Liste" ueberdecken (Nutzerfeedback). Gleiche Ebene
              wie Popups/MapLibres eigene Bedienelemente, siehe globals.css. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 pt-[calc(0.75rem+var(--safe-top))] md:pt-3">
            <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium shadow-md dark:bg-neutral-900/95">
              {isFetchingViewport ? "Lädt…" : `${stationCountLabel} Ladepunkte`}
            </span>
            <div className="pointer-events-auto flex gap-2">
              {FilterButton}
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="flex min-h-11 items-center rounded-full bg-white/95 px-4 text-sm font-medium shadow-md hover:bg-white dark:bg-neutral-900/95 dark:hover:bg-neutral-900"
              >
                Liste
              </button>
            </div>
          </div>

          {stations.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <p className="pointer-events-auto max-w-xs rounded-lg bg-white/95 px-4 py-3 text-center text-sm shadow-md dark:bg-neutral-900/95">
                {emptyMessage}
              </p>
            </div>
          )}
          </div>
          {isTouchMap && (
            <StationBottomSheet
              station={selectedStationSnapshot}
              isLoggedIn={isLoggedIn}
              onClose={() => selectStation(null)}
            />
          )}
        </>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className="flex min-h-11 items-center gap-1.5 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              ← Zur Karte
            </button>
            {FilterButton}
          </div>

          {stations.length > 0 && (
            <div className="mb-4 flex flex-col gap-1">
              <label className="flex items-center gap-2 text-sm">
                Sortieren nach
                <select
                  value={sortOption}
                  onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  className="min-h-11 rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <option key={option} value={option}>
                      {SORT_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
              {sortOption === "distance" && locationLoading && (
                <p className="text-xs text-black/50 dark:text-white/50">Standort wird ermittelt…</p>
              )}
              {sortOption === "distance" && locationError && (
                <p className="text-xs text-red-600">{locationError}</p>
              )}
            </div>
          )}

          {stations.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">{emptyMessage}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {sortedStations.slice(0, visibleCount).map((s) => (
                  <li key={s.id}>
                    <ChargingStationCard
                      station={s}
                      selected={hoveredId === s.id}
                      onHover={setHoveredId}
                      allIds={sortedStationIds}
                    />
                  </li>
                ))}
              </ul>
              {visibleCount < sortedStations.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="mt-3 min-h-11 w-full rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                >
                  Weitere anzeigen ({Math.min(visibleCount, sortedStations.length)} von {sortedStations.length})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {filterOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setFilterOpen(false)}>
          <div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-neutral-900 md:inset-y-0 md:left-0 md:right-auto md:bottom-auto md:h-full md:max-h-none md:w-96 md:rounded-none md:rounded-r-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="Filter schließen"
                className="flex h-11 w-11 items-center justify-center text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {/* Eigenes <form> nur um den Filter-Inhalt, NICHT (wie frueher)
                um die ganze Seite: ein <form> um die komplette Kartenansicht
                verschachtelte darin zwangsläufig auch das Bewertungsformular
                im Bottom-Sheet (StationBottomSheet) -- verschachtelte
                <form>-Elemente sind ungueltiges HTML und fuehrten dazu, dass
                "Bewertung abschicken" wirkungslos blieb (Nutzerfeedback,
                Konsole: "A React form was unexpectedly submitted"). */}
            <form action="/ladepunkte" className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
              {/* Siehe resolveFastChargersOnly (charging-stations.ts): markiert
                  jeden echten Formular-Submit, damit ein bewusst abgewaehltes
                  "Nur Schnelllader" nicht wieder auf den Default zurueckfaellt. */}
              <input type="hidden" name="filters_submitted" value="1" />
              {filterPanel}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
