"use client";

import { useState, useTransition } from "react";
import type { Caravan } from "@/types/database";
import { deleteCaravan } from "@/app/profil/actions";

export function CaravanList({ caravans }: { caravans: Caravan[] }) {
  // Siehe Kommentar in vehicle-list.tsx: der sichtbare Bestand wird aus dem
  // `caravans`-Prop abgeleitet (minus gerade geloeschter IDs), kein
  // separater useState-Zwischenspeicher.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const items = caravans.filter((c) => !removedIds.has(c.id));

  function handleDelete(caravan: Caravan) {
    setPendingId(caravan.id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[caravan.id];
      return next;
    });
    startTransition(async () => {
      const result = await deleteCaravan(caravan.id);
      if (result.ok) {
        setRemovedIds((prev) => new Set(prev).add(caravan.id));
      } else {
        setErrorById((prev) => ({ ...prev, [caravan.id]: result.error }));
      }
      setPendingId(null);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Noch kein Wohnwagen hinterlegt.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((caravan) => (
        <li
          key={caravan.id}
          className="flex flex-col gap-2 rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">
                {caravan.manufacturer} {caravan.model}
              </p>
              <p className="text-black/60 dark:text-white/60">
                {caravan.length_m} × {caravan.width_m} × {caravan.height_m} m · {caravan.weight_kg} kg
                {caravan.gross_vehicle_weight_kg ? ` · zGG ${caravan.gross_vehicle_weight_kg} kg` : ""}
                {caravan.actual_travel_weight_kg ? ` · Reisegewicht ${caravan.actual_travel_weight_kg} kg` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(caravan)}
              disabled={pendingId === caravan.id}
              className="flex min-h-11 items-center px-2 text-sm text-red-600 hover:underline disabled:opacity-50"
              aria-label={`${caravan.manufacturer} ${caravan.model} entfernen`}
            >
              Entfernen
            </button>
          </div>
          {errorById[caravan.id] && <p className="text-xs text-red-600">{errorById[caravan.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
