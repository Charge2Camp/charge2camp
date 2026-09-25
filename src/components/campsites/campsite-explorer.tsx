"use client";

import { useState } from "react";
import Link from "next/link";
import { MapView } from "@/components/map/map-view";
import { CAMPSITE_PIN_ICON_SRC } from "@/lib/trailer-verdict";
import { saveListNavigationContext } from "@/components/list-navigation";
import { loadSavedMapViewport, saveMapViewport, type MapViewport } from "@/lib/map-viewport-storage";
import { useMediaQuery } from "@/lib/use-media-query";
import type { CampsiteSearchRow } from "@/types/database";

const LIST_NAV_STORAGE_KEY = "campingplaetze:list-nav";
const MAP_VIEWPORT_STORAGE_KEY = "campingplaetze:map-viewport";
// Gleiche Query wie charging-station-map-explorer.tsx (TOUCH_MAP_QUERY) --
// Karte + "pointer: coarse" statt nur der md-Breakpoint-Grenze, damit ein
// gedrehtes Handy in Querformat (oft > 767px CSS-Breite) nicht ins
// Desktop-Verhalten zurueckfaellt.
const TOUCH_MAP_QUERY = "(max-width: 767px), (pointer: coarse)";

function CampsiteCard({
  campsite,
  amenityLabels,
  selected,
  onHover,
  allIds,
}: {
  campsite: CampsiteSearchRow;
  amenityLabels: Record<string, string>;
  selected: boolean;
  onHover: (id: string | null) => void;
  /** Alle IDs der aktuellen Listenansicht in Anzeigereihenfolge --
   * gespeichert beim Antippen (Nutzerwunsch: von der Detailseite zum
   * naechsten Ergebnis springen oder zur Liste zurueck koennen, siehe
   * list-navigation.tsx). */
  allIds: string[];
}) {
  return (
    <Link
      href={`/campingplaetze/${campsite.id}`}
      onClick={() => saveListNavigationContext(LIST_NAV_STORAGE_KEY, allIds)}
      onMouseEnter={() => onHover(campsite.id)}
      onMouseLeave={() => onHover(null)}
      className={`block rounded-lg border p-4 transition-colors ${
        selected
          ? "border-route bg-route/5"
          : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      <p className="font-medium">{campsite.name}</p>
      <p className="text-sm text-black/60 dark:text-white/60">
        {[campsite.city, campsite.country_code].filter(Boolean).join(", ")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
        {campsite.charging_on_site && (
          <span className="rounded bg-route/10 px-2 py-0.5 text-route">
            Ladepunkt auf dem Platz
          </span>
        )}
        {!campsite.charging_on_site && campsite.nearest_walk_m != null && (
          <span className="rounded bg-route/10 px-2 py-0.5 text-route">
            Ladepunkt {campsite.nearest_walk_m} m entfernt
          </span>
        )}
        {campsite.amenities.slice(0, 3).map((key) => (
          <span key={key}>{amenityLabels[key] ?? key}</span>
        ))}
      </div>
    </Link>
  );
}

const PAGE_SIZE = 30;

export function CampsiteExplorer({
  campsites,
  amenityLabels,
  emptyMessage = "Keine Campingplätze gefunden. Filter anpassen?",
  homeAddress,
}: {
  campsites: CampsiteSearchRow[];
  amenityLabels: Record<string, string>;
  /** Text, wenn `campsites` leer ist -- z. B. anders formuliert, solange
   * die Favoriten statt echter Filterergebnisse angezeigt werden (siehe
   * campingplaetze/page.tsx). */
  emptyMessage?: string;
  /** Im Profil ("Meine Daten") hinterlegte Zuhause-Adresse -- Kartenmittel-
   * punkt, solange es (noch) keine Marker gibt (kein Filter aktiv, keine
   * Favoriten), statt des generischen Deutschland-weiten Standard-
   * Ausschnitts (Nutzerwunsch, gleiches Prinzip wie auf /ladepunkte).
   * Sobald Marker vorhanden sind, zentriert MapView per fitBounds
   * weiterhin auf DIESE -- unveraendert. */
  homeAddress?: { latitude: number; longitude: number } | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");
  const isTouchMap = useMediaQuery(TOUCH_MAP_QUERY);

  // Auf Touch-Geraeten liegen Liste und Karte in getrennten Tabs (siehe
  // mobileTab) -- ein Tap auf einen Pin waehrend des "Karte"-Tabs setzte
  // bisher nur hoveredId, dessen einziger sichtbarer Effekt (Karten-
  // hervorhebung der CampsiteCard) in der zu dem Zeitpunkt ausgeblendeten
  // Liste lag. Fuer Touch-Nutzer:innen wechselt ein Tap deshalb zusaetzlich
  // automatisch in den "Liste"-Tab, damit der Tap ueberhaupt einen
  // sichtbaren Effekt hat (Audit-Befund 2026-09-22). Auf dem Desktop bleibt
  // das Verhalten unveraendert (beide Spalten ohnehin gleichzeitig sichtbar).
  function handleMarkerClick(id: string | null) {
    setHoveredId(id);
    if (isTouchMap && id) setMobileTab("list");
  }
  // Bei bis zu 5000 Treffern (core.campsite_search, siehe fetchCampsites)
  // wuerde die Liste sonst komplett auf einmal ins DOM gerendert -- auf
  // dem Handy spuerbar langsam (siehe Design-Review). Karte zeigt trotzdem
  // weiterhin ALLE Treffer als Marker, nur die Listen-Karten wachsen
  // schrittweise.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleCampsites = campsites.slice(0, visibleCount);
  const campsiteIds = campsites.map((c) => c.id);

  function handleViewportChange(viewport: MapViewport) {
    saveMapViewport(MAP_VIEWPORT_STORAGE_KEY, viewport);
  }

  // Wird beim (Wieder-)Mounten von MapView ausgewertet (z. B. Rueckkehr von
  // der Campingplatz-Detailseite) -- kein useMemo, absichtlich bei jedem
  // Render frisch aus sessionStorage gelesen (siehe gleiches Muster in
  // charging-station-map-explorer.tsx). Ist ein Ausschnitt gespeichert,
  // soll GENAU der wiederhergestellt werden (Nutzerwunsch) -- das
  // automatische fitBounds auf alle Treffer beim Mounten wird dafuer
  // uebersprungen (siehe fitBoundsOnMarkersChange unten), sonst wuerde es
  // den wiederhergestellten Ausschnitt sofort wieder ueberschreiben.
  const savedViewport = loadSavedMapViewport(MAP_VIEWPORT_STORAGE_KEY);

  const markers = campsites.map((c) => ({
    id: c.id,
    latitude: c.lat,
    longitude: c.lon,
    label: c.name,
    iconSrc: CAMPSITE_PIN_ICON_SRC,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 md:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "list"
              ? "border-route bg-route text-white"
              : "border-line"
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "map"
              ? "border-route bg-route text-white"
              : "border-line"
          }`}
        >
          Karte
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`flex flex-col gap-3 ${mobileTab === "map" ? "hidden md:flex" : ""}`}>
          {campsites.length === 0 ? (
            <p className="text-sm text-text-muted">{emptyMessage}</p>
          ) : (
            <>
              {visibleCampsites.map((c) => (
                <CampsiteCard
                  key={c.id}
                  campsite={c}
                  amenityLabels={amenityLabels}
                  selected={hoveredId === c.id}
                  onHover={setHoveredId}
                  allIds={campsiteIds}
                />
              ))}
              {visibleCount < campsites.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="min-h-11 rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                >
                  Weitere anzeigen ({visibleCampsites.length} von {campsites.length})
                </button>
              )}
            </>
          )}
        </div>

        <div
          className={`h-[400px] overflow-hidden rounded-lg border border-line md:sticky md:top-4 md:h-[600px] ${
            mobileTab === "list" ? "hidden md:block" : ""
          }`}
        >
          {/* onMarkerClick gibt Touch-Nutzern (kein :hover auf dem Handy/
              Tablet) eine Moeglichkeit, den zugehoerigen Listeneintrag
              hervorzuheben, indem sie auf einen Pin tippen. */}
          <MapView
            markers={markers}
            selectedId={hoveredId ?? undefined}
            onMarkerClick={handleMarkerClick}
            onViewportChange={handleViewportChange}
            cluster
            fitBoundsOnMarkersChange={!savedViewport}
            {...(savedViewport
              ? { initialCenter: savedViewport, initialZoom: savedViewport.zoom }
              : homeAddress
                ? { fallbackCenter: homeAddress, fallbackZoom: 10 }
                : {})}
          />
        </div>
      </div>
    </div>
  );
}
