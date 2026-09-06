"use client";

import { useState } from "react";
import Link from "next/link";
import { MapView } from "@/components/map/map-view";
import { TRAILER_VERDICT_COLORS, TRAILER_VERDICT_LABELS } from "@/lib/trailer-verdict";
import type { ChargingStationView } from "@/lib/charging-stations";

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
  const verdict = station.trailer?.verdict ?? "unknown";
  const connectorSummary = Array.from(new Set(station.connectors.map((c) => c.standard).filter(Boolean))).join(", ");

  return (
    <Link
      href={`/ladepunkte/${station.id}`}
      onMouseEnter={() => onHover(station.id)}
      onMouseLeave={() => onHover(null)}
      className={`block rounded-lg border p-4 transition-colors ${
        selected
          ? "border-emerald-600 bg-emerald-600/5"
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
          style={{ backgroundColor: TRAILER_VERDICT_COLORS[verdict] }}
        >
          {TRAILER_VERDICT_LABELS[verdict]}
        </span>
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

export function ChargingStationExplorer({ stations }: { stations: ChargingStationView[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  const markers = stations.map((s) => ({
    id: s.id,
    latitude: s.lat,
    longitude: s.lon,
    label: s.name ?? s.operator ?? "",
    color: TRAILER_VERDICT_COLORS[s.trailer?.verdict ?? "unknown"],
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 md:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm ${
            mobileTab === "list"
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-black/10 dark:border-white/10"
          }`}
        >
          Liste
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`min-h-11 flex-1 rounded-md border px-3 py-2 text-sm ${
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
          <MapView markers={markers} selectedId={hoveredId ?? undefined} onMarkerClick={setHoveredId} />
        </div>
      </div>
    </div>
  );
}
