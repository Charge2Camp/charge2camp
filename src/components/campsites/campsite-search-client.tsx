"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CampsiteQuickFilters } from "@/components/campsites/quick-filters";
import { CampsiteFilterForm } from "@/components/campsites/filter-form";
import { FurtherFiltersSheet } from "@/components/further-filters-sheet";
import { CampsiteExplorer } from "@/components/campsites/campsite-explorer";
import { buildCampsiteFilterParams, computeFurtherFilterCount } from "@/lib/campsite-filters";
import type { CampsiteFilters } from "@/lib/campsites";
import type { CampsiteSearchRow, CoreAmenity } from "@/types/database";

/** Orchestriert die gesamte Campingplatzsuche als Sofort-anwendende
 * Filter (kein <form>/Submit mehr) -- gleiches Muster wie
 * charging-station-map-explorer.tsx: ein clientseitig gehaltener
 * Live-Filterzustand, jede Aenderung synchronisiert per `router.replace`
 * die URL (Teilen-Links/Zurueck-Button bleiben korrekt) und loest damit
 * einen Server-Refetch von campingplaetze/page.tsx aus -- Liste UND Karte
 * passen sich dadurch sofort an, ohne eigenen "Filtern"-Button (Nutzeranfrage,
 * wie beim Routenplaner/bei den Ladepunkten). */
export function CampsiteSearchClient({
  filters,
  campsites,
  countries,
  amenityCatalog,
  nameOptions,
  emptyMessage,
  homeAddress,
  children,
}: {
  filters: CampsiteFilters;
  campsites: CampsiteSearchRow[];
  countries: string[];
  amenityCatalog: CoreAmenity[];
  nameOptions: string[];
  emptyMessage: string;
  homeAddress: { latitude: number; longitude: number } | null;
  /** Favoriten-Kurzliste -- serverseitig gerendert, siehe
   * favorites-quick-list.tsx, hier nur als Slot zwischen Filtern und
   * Ergebnissen platziert. */
  children?: ReactNode;
}) {
  const router = useRouter();

  // Live-Filterzustand, initialisiert aus der Server-Erstansicht (`filters`-
  // Prop) -- Server/Client-Hydration stimmen so exakt ueberein. Bei jeder
  // Navigation (router.replace unten) behaelt Next den Client-State bewusst
  // bei (kein Remount), deshalb wird `liveFilters` bei einer Aenderung von
  // `filters` ueber den Router explizit nachgezogen (Mikrotask-entkoppelt,
  // gleiches Muster wie charging-station-map-explorer.tsx).
  const [liveFilters, setLiveFilters] = useState<CampsiteFilters>(filters);
  useEffect(() => {
    void Promise.resolve().then(() => setLiveFilters(filters));
  }, [filters]);

  const evAmenityKeys = new Set(amenityCatalog.filter((a) => a.category === "laden").map((a) => a.key));
  const furtherFilterCount = computeFurtherFilterCount(liveFilters, evAmenityKeys);

  // Mehrere Filteraenderungen kurz hintereinander (z. B. schnelles
  // Umschalten zwischen zwei Chips) loesten bisher JEDE fuer sich eine
  // eigene router.replace-Navigation aus -- mehrere ueberlappende RSC-
  // Anfragen gegen denselben Turbopack-Dev-Server konnten dabei sporadisch
  // einen Chunk-Ladefehler ausloesen ("Failed to load module script...
  // text/html", vereinzelt bis zur error.tsx-Fehlerseite eskaliert,
  // Audit-Befund 2026-09-28). Die Chip-Optik selbst bleibt sofort reaktiv
  // (setLiveFilters direkt), nur die tatsaechliche Navigation wird debounct
  // -- gleiches Prinzip wie VIEWPORT_FETCH_DEBOUNCE_MS in
  // charging-station-map-explorer.tsx, dort fuers Kartenschwenken statt
  // fuer Filter-Chips.
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
  }, []);

  function applyFilters(patch: Partial<CampsiteFilters>) {
    const next: CampsiteFilters = { ...liveFilters, ...patch };
    setLiveFilters(next);
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    navigateTimerRef.current = setTimeout(() => {
      const params = buildCampsiteFilterParams(next);
      router.replace(`/campingplaetze?${params.toString()}`, { scroll: false });
    }, 250);
  }

  function resetFilters() {
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    router.push("/campingplaetze");
  }

  const hasActiveFilters = Boolean(
    liveFilters.q ||
      liveFilters.country ||
      liveFilters.charging ||
      liveFilters.evScoreMin ||
      liveFilters.ratingMin ||
      liveFilters.near ||
      liveFilters.amenities.length > 0
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <CampsiteQuickFilters filters={liveFilters} onChange={applyFilters} countries={countries} />

        <div className="flex flex-wrap items-center gap-3">
          <FurtherFiltersSheet activeFilterCount={furtherFilterCount}>
            <CampsiteFilterForm
              filters={liveFilters}
              onChange={applyFilters}
              amenityCatalog={amenityCatalog}
              nameOptions={nameOptions}
            />
          </FurtherFiltersSheet>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {children}

      <CampsiteExplorer
        campsites={campsites}
        amenityLabels={Object.fromEntries(amenityCatalog.map((a) => [a.key, a.label_de]))}
        emptyMessage={emptyMessage}
        // Bei aktiver Umkreissuche ist der gesuchte Ort der sinnvollere
        // Kartenmittelpunkt als die Zuhause-Adresse -- v. a. relevant, wenn
        // der Umkreis (noch) keine Treffer enthaelt (sonst zentriert
        // fitBoundsOnMarkersChange ohnehin auf die Treffer, siehe
        // campsite-explorer.tsx).
        homeAddress={liveFilters.near ? { latitude: liveFilters.near.latitude, longitude: liveFilters.near.longitude } : homeAddress}
        hasNearFilter={Boolean(liveFilters.near)}
      />
    </div>
  );
}
