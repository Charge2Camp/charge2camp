"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MapView } from "@/components/map/map-view";
import { TRAILER_PIN_COLORS, TRAILER_PIN_ICON_SRC, TRAILER_PIN_LABELS, getTrailerPinState } from "@/lib/trailer-verdict";
import { ReviewStateBadge } from "@/components/charging-stations/review-state-badge";
import { formatConnectorStandard } from "@/lib/connector-standard";
import type { ChargingStationView } from "@/lib/charging-stations";

const PAGE_SIZE = 30;

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
}: {
  station: ChargingStationView;
  selected: boolean;
  onHover: (id: string | null) => void;
}) {
  const pinState = getTrailerPinState(station.trailer);
  const connectorSummary = Array.from(new Set(station.connectors.map((c) => formatConnectorStandard(c.standard)))).join(
    ", "
  );

  return (
    <Link
      href={`/ladepunkte/${station.id}`}
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
  stations,
  stationCountLabel,
  emptyMessage,
  filterPanel,
  activeFilterCount,
}: {
  stations: ChargingStationView[];
  /** Anzeige-Text fuer die Trefferzahl (z. B. "1500+", wenn das serverseitige
   * Limit erreicht wurde) -- vorformatiert vom Aufrufer, da der nur das
   * jeweils gueltige Limit kennt (unterschiedlich je nachdem, ob gefiltert
   * wird, siehe ladepunkte/page.tsx). */
  stationCountLabel: string;
  /** Text, wenn `stations` leer ist. */
  emptyMessage: string;
  /** Formularfelder (Quick-Filter + "weitere Filter"), inkl. Submit/Reset --
   * gehoert zum umschliessenden <form> in ladepunkte/page.tsx. */
  filterPanel: ReactNode;
  activeFilterCount: number;
}) {
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Ohne Filter kann die Liste 1000+ Eintraege umfassen (siehe ladepunkte/
  // page.tsx) -- auf einmal ins DOM gerendert waere das spuerbar langsam,
  // deshalb wie bei den Campingplaetzen/Ladepunkten-Listen zuvor
  // schrittweise wachsend statt paginiert.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const markers = stations.map((s) => ({
    id: s.id,
    latitude: s.lat,
    longitude: s.lon,
    label: s.name ?? s.operator ?? "",
    iconSrc: TRAILER_PIN_ICON_SRC[getTrailerPinState(s.trailer)],
  }));

  const FilterButton = (
    <button
      type="button"
      onClick={() => setFilterOpen(true)}
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
    <div className="relative mt-6">
      {viewMode === "map" ? (
        <div className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-black/10 dark:border-white/10 md:h-[75vh]">
          <MapView markers={markers} selectedId={hoveredId ?? undefined} onMarkerClick={setHoveredId} cluster />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
            <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium shadow-md dark:bg-neutral-900/95">
              {stationCountLabel} Ladepunkte
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

          {stations.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">{emptyMessage}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {stations.slice(0, visibleCount).map((s) => (
                  <li key={s.id}>
                    <ChargingStationCard station={s} selected={hoveredId === s.id} onHover={setHoveredId} />
                  </li>
                ))}
              </ul>
              {visibleCount < stations.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="mt-3 min-h-11 w-full rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                >
                  Weitere anzeigen ({Math.min(visibleCount, stations.length)} von {stations.length})
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
            <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:border-white/10">
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
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{filterPanel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
