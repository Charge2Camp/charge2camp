"use client";

import { useMemo, useState } from "react";
import { addVehicle } from "@/app/profil/actions";
import type { VehicleModel } from "@/types/database";

const EMPTY_FORM = {
  manufacturer: "",
  model: "",
  battery_capacity_kwh: "",
  consumption_kwh_per_100km: "",
  range_km: "",
  length_m: "",
};

export function VehicleForm({ models }: { models: VehicleModel[] }) {
  const [manufacturer, setManufacturer] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const manufacturers = useMemo(
    () => Array.from(new Set(models.map((m) => m.manufacturer))).sort(),
    [models]
  );

  const modelsForManufacturer = useMemo(
    () => models.filter((m) => m.manufacturer === manufacturer),
    [models, manufacturer]
  );

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  function handleManufacturerSelect(value: string) {
    setManufacturer(value);
    setSelectedId("");
    setForm({ ...EMPTY_FORM, manufacturer: value });
  }

  function handleModelSelect(id: string) {
    setSelectedId(id);
    if (!id) {
      setForm({ ...EMPTY_FORM, manufacturer });
      return;
    }
    const m = byId.get(id);
    if (!m) return;
    setForm({
      manufacturer: m.manufacturer,
      model: m.model,
      battery_capacity_kwh: m.battery_capacity_kwh?.toString() ?? "",
      consumption_kwh_per_100km: m.consumption_kwh_per_100km?.toString() ?? "",
      range_km: m.range_km?.toString() ?? "",
      length_m: m.length_m?.toString() ?? "",
    });
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await addVehicle(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setManufacturer("");
        setSelectedId("");
        setForm(EMPTY_FORM);
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Hersteller auswählen
          <select
            value={manufacturer}
            onChange={(e) => handleManufacturerSelect(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Manuell eingeben…</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modell auswählen (füllt die Felder unten automatisch aus)
          <select
            value={selectedId}
            onChange={(e) => handleModelSelect(e.target.value)}
            disabled={!manufacturer}
            className="rounded-md border border-black/15 px-3 py-2 text-base disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Manuell eingeben…</option>
            {modelsForManufacturer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model} {m.variant}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="model_reference_id" value={selectedId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Hersteller *
          <input
            name="manufacturer"
            required
            value={form.manufacturer}
            onChange={(e) => updateField("manufacturer", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modell *
          <input
            name="model"
            required
            value={form.model}
            onChange={(e) => updateField("model", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
            value={form.battery_capacity_kwh}
            onChange={(e) => updateField("battery_capacity_kwh", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Verbrauch (kWh/100km)
          <input
            name="consumption_kwh_per_100km"
            type="number"
            step="0.1"
            min="0"
            value={form.consumption_kwh_per_100km}
            onChange={(e) => updateField("consumption_kwh_per_100km", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Reichweite (km)
          <input
            name="range_km"
            type="number"
            step="1"
            min="0"
            value={form.range_km}
            onChange={(e) => updateField("range_km", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fahrzeuglänge (m)
          <input
            name="length_m"
            type="number"
            step="0.01"
            min="0"
            value={form.length_m}
            onChange={(e) => updateField("length_m", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <button
          type="submit"
          className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover"
        >
          Elektroauto hinzufügen
        </button>
      </div>
    </form>
  );
}
