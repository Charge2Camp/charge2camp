"use client";

import { useState, type ReactNode } from "react";

/** Auf schmalen Screens stehen Filter sonst VOR den Ergebnissen -- bei
 * z. B. 28 Merkmals-Checkboxen (core.amenity) muss man erst mehrere
 * Bildschirmhoehen Formular durchscrollen, bevor der erste Treffer
 * sichtbar wird (siehe Design-Review). Dieses Vollbild-Sheet (§ Mobile/
 * Touch-Design, docs/architecture.md) haelt die Filter stattdessen hinter
 * einem Button verborgen, Ergebnisse erscheinen sofort. Ab `lg` bleibt die
 * bisherige feste Sidebar unveraendert (siehe campingplaetze/page.tsx,
 * ladepunkte/page.tsx -- dort ist dieses Sheet per `lg:hidden` inaktiv). */
export function MobileFilterSheet({
  children,
  activeFilterCount,
}: {
  children: ReactNode;
  activeFilterCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex min-h-11 items-center gap-2 rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/15"
      >
        Filter
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-route px-1 text-xs text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="ml-auto flex h-full w-full max-w-sm flex-col overflow-hidden bg-white dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:border-white/10">
              <h2 className="text-lg font-semibold">Filter</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Filter schließen"
                className="flex h-11 w-11 items-center justify-center text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
