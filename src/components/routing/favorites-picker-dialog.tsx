"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
    <Modal
      open={open}
      onClose={handleClose}
      title={selected ? "Als Start oder Ziel verwenden?" : "Aus Favoriten wählen"}
    >
      {selected ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  {ENTITY_LABELS[selected.entityType]}
                </span>
                {selected.name}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handlePick("start")}
                  className="min-h-12 flex-1 rounded-md border border-route px-4 py-3 text-sm font-medium text-route hover:bg-route/10"
                >
                  Als Start verwenden
                </button>
                <Button size="md" onClick={() => handlePick("end")} className="flex-1">
                  Als Ziel verwenden
                </Button>
              </div>
              <Button variant="plain" size="link" onClick={() => setSelected(null)} className="self-start text-text-muted">
                ← Zurück zur Liste
              </Button>
            </div>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-text-muted">
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
                    className="flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
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
    </Modal>
  );
}
