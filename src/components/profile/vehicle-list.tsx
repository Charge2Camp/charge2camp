"use client";

import { useState, useTransition } from "react";
import type { Vehicle } from "@/types/database";
import { deleteVehicle } from "@/app/profil/actions";

export function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  // Kein useState(vehicles)-Zwischenspeicher: der sichtbare Bestand wird bei
  // jedem Render direkt aus dem `vehicles`-Prop abgeleitet, minus gerade
  // erfolgreich geloeschter IDs. So bleibt der Prop (aktualisiert der Server
  // per revalidatePath, z. B. wenn das benachbarte VehicleForm ein neues
  // Fahrzeug hinzufuegt) IMMER die Quelle der Wahrheit -- ohne einen
  // useEffect-Resync-Mechanismus, der leicht veraltet/inkonsistent werden
  // kann (siehe React-Doku "You Might Not Need An Effect").
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const items = vehicles.filter((v) => !removedIds.has(v.id));

  function handleDelete(vehicle: Vehicle) {
    setPendingId(vehicle.id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[vehicle.id];
      return next;
    });
    startTransition(async () => {
      const result = await deleteVehicle(vehicle.id);
      if (result.ok) {
        setRemovedIds((prev) => new Set(prev).add(vehicle.id));
      } else {
        setErrorById((prev) => ({ ...prev, [vehicle.id]: result.error }));
      }
      setPendingId(null);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Noch kein Elektroauto hinterlegt.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((vehicle) => (
        <li
          key={vehicle.id}
          className="flex flex-col gap-2 rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
        >
          <div className="flex items-center justify-between gap-4">
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
              onClick={() => handleDelete(vehicle)}
              disabled={pendingId === vehicle.id}
              className="flex min-h-11 items-center px-2 text-sm text-red-600 hover:underline disabled:opacity-50"
              aria-label={`${vehicle.manufacturer} ${vehicle.model} entfernen`}
            >
              Entfernen
            </button>
          </div>
          {errorById[vehicle.id] && <p className="text-xs text-red-600">{errorById[vehicle.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
