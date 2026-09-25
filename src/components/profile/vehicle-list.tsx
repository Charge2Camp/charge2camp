"use client";

import { useState } from "react";
import type { Vehicle, VehicleModel } from "@/types/database";
import { VehicleEditDialog } from "./vehicle-edit-dialog";

export function VehicleList({ vehicles, models }: { vehicles: Vehicle[]; models: VehicleModel[] }) {
  // Kein useState(vehicles)-Zwischenspeicher: der sichtbare Bestand wird bei
  // jedem Render direkt aus dem `vehicles`-Prop abgeleitet, minus gerade
  // erfolgreich geloeschter IDs. So bleibt der Prop (aktualisiert der Server
  // per revalidatePath, z. B. wenn das benachbarte VehicleForm ein neues
  // Fahrzeug hinzufuegt) IMMER die Quelle der Wahrheit -- ohne einen
  // useEffect-Resync-Mechanismus, der leicht veraltet/inkonsistent werden
  // kann (siehe React-Doku "You Might Not Need An Effect").
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = vehicles.filter((v) => !removedIds.has(v.id));
  const editingVehicle = items.find((v) => v.id === editingId) ?? null;

  if (items.length === 0) {
    return <p className="text-sm text-text-muted">Noch kein Elektroauto hinterlegt.</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((vehicle) => (
          <li
            key={vehicle.id}
            className="flex items-center justify-between gap-4 rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
          >
            <div className="text-sm">
              <p className="font-medium">
                {vehicle.manufacturer} {vehicle.model}
              </p>
              <p className="text-black/60 dark:text-white/60">
                {vehicle.battery_capacity_kwh} kWh
                {vehicle.consumption_kwh_per_100km ? ` · ${vehicle.consumption_kwh_per_100km} kWh/100km` : ""}
                {vehicle.charging_power_kw ? ` · ${vehicle.charging_power_kw} kW Ladeleistung` : ""}
                {vehicle.range_km ? ` · ${vehicle.range_km} km Reichweite` : ""}
                {vehicle.length_m ? ` · ${vehicle.length_m} m lang` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingId(vehicle.id)}
              className="flex min-h-11 items-center px-2 text-sm font-medium text-route hover:underline"
              aria-label={`${vehicle.manufacturer} ${vehicle.model} bearbeiten`}
            >
              Bearbeiten
            </button>
          </li>
        ))}
      </ul>

      {editingVehicle && (
        <VehicleEditDialog
          vehicle={editingVehicle}
          models={models}
          open
          onClose={() => setEditingId(null)}
          onDeleted={(id) => setRemovedIds((prev) => new Set(prev).add(id))}
        />
      )}
    </>
  );
}
