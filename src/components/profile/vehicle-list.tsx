import type { Vehicle } from "@/types/database";
import { deleteVehicle } from "@/app/profil/actions";

export function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Noch kein Elektroauto hinterlegt.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {vehicles.map((vehicle) => (
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
              {vehicle.max_towing_weight_braked_kg
                ? ` · ${vehicle.max_towing_weight_braked_kg} kg Anhängelast`
                : ""}
              {vehicle.length_m ? ` · ${vehicle.length_m} m lang` : ""}
              {vehicle.width_m ? ` · ${vehicle.width_m} m breit` : ""}
              {vehicle.height_m ? ` · ${vehicle.height_m} m hoch` : ""}
              {vehicle.weight_kg ? ` · ${vehicle.weight_kg} kg` : ""}
            </p>
          </div>
          <form action={deleteVehicle}>
            <input type="hidden" name="id" value={vehicle.id} />
            <button
              type="submit"
              className="flex min-h-11 items-center px-2 text-sm text-red-600 hover:underline"
              aria-label={`${vehicle.manufacturer} ${vehicle.model} entfernen`}
            >
              Entfernen
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
