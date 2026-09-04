import { addVehicle } from "@/app/profil/actions";

export function VehicleForm() {
  return (
    <form action={addVehicle} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Hersteller *
        <input
          name="manufacturer"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Modell *
        <input
          name="model"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Batteriegröße (kWh) *
        <input
          name="battery_capacity_kwh"
          type="number"
          step="0.1"
          min="0"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Verbrauch (kWh/100km)
        <input
          name="consumption_kwh_per_100km"
          type="number"
          step="0.1"
          min="0"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ladeleistung (kW)
        <input
          name="charging_power_kw"
          type="number"
          step="0.1"
          min="0"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Reichweite (km)
        <input
          name="range_km"
          type="number"
          step="1"
          min="0"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Elektroauto hinzufügen
        </button>
      </div>
    </form>
  );
}
