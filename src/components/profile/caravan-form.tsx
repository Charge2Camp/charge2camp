import { addCaravan } from "@/app/profil/actions";

export function CaravanForm() {
  return (
    <form action={addCaravan} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        Länge (m) *
        <input
          name="length_m"
          type="number"
          step="0.01"
          min="0"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Breite (m) *
        <input
          name="width_m"
          type="number"
          step="0.01"
          min="0"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Höhe (m) *
        <input
          name="height_m"
          type="number"
          step="0.01"
          min="0"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Gewicht (kg) *
        <input
          name="weight_kg"
          type="number"
          step="1"
          min="0"
          required
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Zulässiges Gesamtgewicht (kg)
        <input
          name="gross_vehicle_weight_kg"
          type="number"
          step="1"
          min="0"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Tatsächliches Reisegewicht (kg)
        <input
          name="actual_travel_weight_kg"
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
          Wohnwagen hinzufügen
        </button>
      </div>
    </form>
  );
}
