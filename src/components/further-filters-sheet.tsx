"use client";

import { useState, type ReactNode } from "react";

/** "Weitere Filter" als Vollbild-Pop-up -- auf ALLEN Bildschirmgroessen
 * aktiv, nicht nur mobil: die jeweils wichtigsten Filter (z. B.
 * Elektromobilitaet + Land bei Campingplaetzen, Anhaengertauglichkeit bei
 * Ladepunkten) stehen direkt auf der Seite (siehe quick-filters.tsx im
 * jeweiligen Feature-Ordner), der Rest bleibt dahinter verborgen, egal ob
 * Desktop oder Handy. */
export function FurtherFiltersSheet({
  children,
  activeFilterCount,
}: {
  children: ReactNode;
  activeFilterCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-medium"
      >
        Weitere Filter
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
            <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10">
              <h2 className="text-lg font-semibold">Weitere Filter</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Filter schließen"
                className="flex h-11 w-11 items-center justify-center text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
