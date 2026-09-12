"use client";

import { useState } from "react";
import Link from "next/link";
import { TRAILER_VERDICT_COLORS, TRAILER_VERDICT_LABELS } from "@/lib/trailer-verdict";
import { ReviewStateBadge } from "@/components/charging-stations/review-state-badge";
import type { LinkedChargePoint } from "@/lib/campsite-charging-links";

/** "Ladepunkte in der Naehe" -- Klick auf einen Eintrag oeffnet die Details
 * als Pop-up statt sofort zur Ladepunkt-Seite zu navigieren (Nutzerwunsch),
 * mit einem Link von dort aus fuer wer die volle Detailseite will. */
export function NearbyChargePointsList({ points }: { points: LinkedChargePoint[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find((p) => p.id === selectedId) ?? null;

  // Reihenfolge/Auswahl (max. 3 fussläufige nach Ladeleistung + max. 2
  // nicht-fussläufige Schnelllader nach Entfernung) wird bereits vom
  // Aufrufer festgelegt (campingplaetze/[id]/page.tsx), hier nur gerendert.
  return (
    <>
      <ul className="mt-2 flex flex-col gap-2">
        {points.map((point) => (
          <li key={point.id}>
            <button
              type="button"
              onClick={() => setSelectedId(point.id)}
              className="flex w-full items-center justify-between rounded-md border border-black/10 px-4 py-2 text-left text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            >
              <div>
                <p className="font-medium">{point.name ?? point.operator}</p>
                <p className="text-black/60 dark:text-white/60">
                  {point.max_power_kw ? `${point.max_power_kw} kW` : ""}
                  {" · "}
                  <span style={{ color: TRAILER_VERDICT_COLORS[point.trailerVerdict] }}>
                    {TRAILER_VERDICT_LABELS[point.trailerVerdict]}
                  </span>
                </p>
                <ReviewStateBadge origin={point.trailerOrigin} className="mt-1" />
              </div>
              <span className="shrink-0 pl-3 text-right text-black/50 dark:text-white/50">
                {!point.walkable ? (
                  <>
                    <span className="block rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-black/70 dark:bg-white/10 dark:text-white/70">
                      nicht fußläufig
                    </span>
                    <span className="mt-1 block">{(point.air_distance_m / 1000).toFixed(1)} km Luftlinie</span>
                  </>
                ) : point.walk_distance_m != null ? (
                  `${(point.walk_distance_m / 1000).toFixed(1)} km zu Fuß`
                ) : (
                  `${(point.air_distance_m / 1000).toFixed(1)} km Luftlinie`
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-lg bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:bg-neutral-900 sm:rounded-lg sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold">{selected.name ?? selected.operator}</p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Schließen"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-xl leading-none text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <span
              className="mt-2 inline-block rounded-full px-3 py-1 text-sm text-white"
              style={{ backgroundColor: TRAILER_VERDICT_COLORS[selected.trailerVerdict] }}
            >
              {TRAILER_VERDICT_LABELS[selected.trailerVerdict]}
            </span>{" "}
            <ReviewStateBadge origin={selected.trailerOrigin} className="mt-2 px-3 py-1 text-sm" />
            <ul className="mt-3 space-y-1 text-sm text-black/70 dark:text-white/70">
              {selected.operator && selected.name && <li>Betreiber: {selected.operator}</li>}
              {selected.max_power_kw && <li>Max. Ladeleistung: {selected.max_power_kw} kW</li>}
              {!selected.walkable && (
                <li className="font-medium text-black dark:text-white">
                  Nicht fußläufig erreichbar – nur mit dem Auto sinnvoll erreichbar
                </li>
              )}
              <li>
                {selected.walkable && selected.walk_distance_m != null
                  ? `${(selected.walk_distance_m / 1000).toFixed(1)} km zu Fuß`
                  : `${(selected.air_distance_m / 1000).toFixed(1)} km Luftlinie`}
              </li>
            </ul>
            <Link
              href={`/ladepunkte/${selected.id}`}
              className="mt-4 flex min-h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-base hover:bg-action-hover"
            >
              Zur Ladestation
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
