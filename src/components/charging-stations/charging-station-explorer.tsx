"use client";

import { useState } from "react";
import { MapView } from "@/components/map/map-view";
import { TRAILER_SUITABILITY_COLORS, TRAILER_SUITABILITY_LABELS } from "@/lib/trailer-suitability";
import type { ChargingStation } from "@/types/database";

function StatusBadge({ status }: { status: string }) {
  if (status.startsWith("demo_")) {
    return (
      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
        [DEMO] Live-Status nicht verfügbar
      </span>
    );
  }
  return <span className="rounded bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{status}</span>;
}

function ChargingStationCard({
  station,
  selected,
  onHover,
}: {
  station: ChargingStation;
  selected: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-lg border p-4 transition-colors ${
        selected
          ? "border-emerald-600 bg-emerald-600/5"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{station.name ?? station.provider}</p>
          <p className="text-sm text-black/60 dark:text-white/60">{station.provider}</p>
        </div>
        <StatusBadge status={station.status} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span
          className="rounded-full px-2 py-0.5 text-white"
          style={{ backgroundColor: TRAILER_SUITABILITY_COLORS[station.trailer_suitable] }}
        >
          {TRAILER_SUITABILITY_LABELS[station.trailer_suitable]}
        </span>
        {station.power_kw && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
            {station.power_kw} kW
          </span>
        )}
        {station.connector_type && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
            {station.connector_type}
          </span>
        )}
        {station.price != null && (
          <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/10">
            {station.price.toFixed(2)} {station.currency ?? "EUR"}/kWh
          </span>
        )}
      </div>

      {station.trailer_notes && (
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">{station.trailer_notes}</p>
      )}
    </div>
  );
}

export function ChargingStationExplorer({ stations }: { stations: ChargingStation[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  const markers = stations.map((s) => ({
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    label: s.name ?? s.provider,
    color: TRAILER_SUITABILITY_COLORS[s.trailer_suitable],
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
          {stations.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Keine Ladepunkte gefunden. Filter anpassen?
            </p>
          ) : (
            stations.map((s) => (
              <ChargingStationCard
                key={s.id}
                station={s}
                selected={hoveredId === s.id}
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
          <MapView markers={markers} selectedId={hoveredId ?? undefined} />
        </div>
      </div>
    </div>
  );
}
