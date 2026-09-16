"use client";

import { useState } from "react";
import type { FavoriteDestinationOption } from "@/lib/favorites";

const ENTITY_LABELS: Record<FavoriteDestinationOption["entityType"], string> = {
  campsite: "Campingplatz",
  charging_station: "Ladepunkt",
};

/**
 * Zwei-Schritt-Auswahl: zuerst ein Favorit aus der Liste, dann die Frage,
 * ob er als Start oder Ziel der Routenplanung uebernommen werden soll.
 * Liefert Name + bereits bekannte Koordinaten zurueck (kein erneutes
 * Geocoding noetig, siehe route-planner-form.tsx `onPick`).
 */
export function FavoritesPickerDialog({
  open,
  favorites,
  onClose,
  onPick,
}: {
  open: boolean;
  favorites: FavoriteDestinationOption[];
  onClose: () => void;
  onPick: (favorite: FavoriteDestinationOption, target: "start" | "end") => void;
}) {
  const [selected, setSelected] = useState<FavoriteDestinationOption | null>(null);

  if (!open) return null;

  function handleClose() {
    setSelected(null);
    onClose();
  }

  function handlePick(target: "start" | "end") {
    if (!selected) return;
    onPick(selected, target);
    setSelected(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">
            {selected ? "Als Start oder Ziel verwenden?" : "Aus Favoriten wählen"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
          {selected ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-black/70 dark:text-white/70">
                <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  {ENTITY_LABELS[selected.entityType]}
                </span>
                {selected.name}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handlePick("start")}
                  className="min-h-12 flex-1 rounded-md border border-route px-4 py-3 text-sm font-medium text-route hover:bg-route/10 "
                >
                  Als Start verwenden
                </button>
                <button
                  type="button"
                  onClick={() => handlePick("end")}
                  className="min-h-12 flex-1 rounded-md bg-action px-4 py-3 text-sm font-medium text-base hover:bg-action-hover"
                >
                  Als Ziel verwenden
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="min-h-11 self-start text-sm text-black/60 hover:underline dark:text-white/60"
              >
                ← Zurück zur Liste
              </button>
            </div>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Noch keine Favoriten gemerkt -- über das Herz-Symbol auf einer Campingplatz- oder
              Ladepunkt-Detailseite hinzufügen.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {favorites.map((favorite) => (
                <li key={`${favorite.entityType}-${favorite.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(favorite)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                      {ENTITY_LABELS[favorite.entityType]}
                    </span>
                    <span className="truncate">{favorite.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
