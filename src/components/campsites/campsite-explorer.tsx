"use client";

import { useState } from "react";
import Link from "next/link";
import { CampsiteMap } from "@/components/map/campsite-map";
import type { Campsite } from "@/types/database";

function CampsiteCard({
  campsite,
  selected,
  onHover,
}: {
  campsite: Campsite;
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
          ? "border-emerald-600 bg-emerald-600/5"
          : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      <p className="font-medium">{campsite.name}</p>
      <p className="text-sm text-black/60 dark:text-white/60">
        {[campsite.region, campsite.country].filter(Boolean).join(", ")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-black/50 dark:text-white/50">
        {campsite.ev_charging_on_site && (
          <span className="rounded bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
            Ladepunkt auf dem Platz
          </span>
        )}
        {campsite.sea && <span>Meer</span>}
        {campsite.lake && <span>See</span>}
        {campsite.mountain && <span>Berge</span>}
        {campsite.rating_avg && <span>★ {campsite.rating_avg.toFixed(1)}</span>}
      </div>
    </Link>
  );
}

export function CampsiteExplorer({ campsites }: { campsites: Campsite[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  const markers = campsites.map((c) => ({
    id: c.id,
    latitude: c.latitude,
    longitude: c.longitude,
    label: c.name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 md:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "list"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "map"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Karte
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`flex flex-col gap-3 ${mobileTab === "map" ? "hidden md:flex" : ""}`}>
          {campsites.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Keine Campingplätze gefunden. Filter anpassen?
            </p>
          ) : (
            campsites.map((c) => (
              <CampsiteCard
                key={c.id}
                campsite={c}
                selected={hoveredId === c.id}
                onHover={setHoveredId}
              />
            ))
          )}
        </div>

        <div
          className={`h-[400px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10 md:sticky md:top-4 md:h-[600px] ${
            mobileTab === "list" ? "hidden md:block" : ""
          }`}
        >
          <CampsiteMap markers={markers} selectedId={hoveredId ?? undefined} />
        </div>
      </div>
    </div>
  );
}
