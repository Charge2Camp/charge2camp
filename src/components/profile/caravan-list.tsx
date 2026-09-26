"use client";

import { useState } from "react";
import type { Caravan, CaravanModel } from "@/types/database";
import { CaravanEditDialog } from "./caravan-edit-dialog";

export function CaravanList({ caravans, models }: { caravans: Caravan[]; models: CaravanModel[] }) {
  // Siehe Kommentar in vehicle-list.tsx: der sichtbare Bestand wird aus dem
  // `caravans`-Prop abgeleitet (minus gerade geloeschter IDs), kein
  // separater useState-Zwischenspeicher.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = caravans.filter((c) => !removedIds.has(c.id));
  const editingCaravan = items.find((c) => c.id === editingId) ?? null;

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Noch kein Wohnwagen hinterlegt.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((caravan) => (
          <li
            key={caravan.id}
            className="flex items-center justify-between gap-4 rounded-md border border-line px-4 py-3"
          >
            <div className="text-sm">
              <p className="font-medium">
                {caravan.manufacturer} {caravan.model}
              </p>
              <p className="text-text-muted">
                {caravan.length_m} × {caravan.width_m} × {caravan.height_m} m
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingId(caravan.id)}
              className="flex min-h-11 items-center px-2 text-sm font-medium text-route hover:underline"
              aria-label={`${caravan.manufacturer} ${caravan.model} bearbeiten`}
            >
              Bearbeiten
            </button>
          </li>
        ))}
      </ul>

      {editingCaravan && (
        <CaravanEditDialog
          caravan={editingCaravan}
          models={models}
          open
          onClose={() => setEditingId(null)}
          onDeleted={(id) => setRemovedIds((prev) => new Set(prev).add(id))}
        />
      )}
    </>
  );
}
