"use client";

import { useState } from "react";
import Link from "next/link";
import { MapView } from "@/components/map/map-view";
import { CAMPSITE_PIN_ICON_SRC } from "@/lib/trailer-verdict";
import type { CampsiteSearchRow } from "@/types/database";

function CampsiteCard({
  campsite,
  amenityLabels,
  selected,
  onHover,
}: {
  campsite: CampsiteSearchRow;
  amenityLabels: Record<string, string>;
  selected: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <Link
      href={`/campingplaetze/${campsite.id}`}
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
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-black/50 dark:text-white/50">
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
}: {
  campsites: CampsiteSearchRow[];
  amenityLabels: Record<string, string>;
  /** Text, wenn `campsites` leer ist -- z. B. anders formuliert, solange
   * die Favoriten statt echter Filterergebnisse angezeigt werden (siehe
   * campingplaetze/page.tsx). */
  emptyMessage?: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");
  // Bei bis zu 5000 Treffern (core.campsite_search, siehe fetchCampsites)
  // wuerde die Liste sonst komplett auf einmal ins DOM gerendert -- auf
  // dem Handy spuerbar langsam (siehe Design-Review). Karte zeigt trotzdem
  // weiterhin ALLE Treffer als Marker, nur die Listen-Karten wachsen
  // schrittweise.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleCampsites = campsites.slice(0, visibleCount);

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
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "map"
              ? "border-route bg-route text-white"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Karte
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`flex flex-col gap-3 ${mobileTab === "map" ? "hidden md:flex" : ""}`}>
          {campsites.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">{emptyMessage}</p>
          ) : (
            <>
              {visibleCampsites.map((c) => (
                <CampsiteCard
                  key={c.id}
                  campsite={c}
                  amenityLabels={amenityLabels}
                  selected={hoveredId === c.id}
                  onHover={setHoveredId}
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
          className={`h-[400px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10 md:sticky md:top-4 md:h-[600px] ${
            mobileTab === "list" ? "hidden md:block" : ""
          }`}
        >
          {/* onMarkerClick gibt Touch-Nutzern (kein :hover auf dem Handy/
              Tablet) eine Moeglichkeit, den zugehoerigen Listeneintrag
              hervorzuheben, indem sie auf einen Pin tippen. */}
          <MapView markers={markers} selectedId={hoveredId ?? undefined} onMarkerClick={setHoveredId} cluster />
        </div>
      </div>
    </div>
  );
}
