"use client";

import { useMemo, useState } from "react";
import { addVehicle } from "@/app/profil/actions";
import type { VehicleModel } from "@/types/database";

const EMPTY_FORM = {
  manufacturer: "",
  model: "",
  battery_capacity_kwh: "",
  consumption_kwh_per_100km: "",
  charging_power_kw: "",
  range_km: "",
  max_towing_weight_braked_kg: "",
  length_m: "",
  width_m: "",
  height_m: "",
  weight_kg: "",
};

export function VehicleForm({ models }: { models: VehicleModel[] }) {
  const [manufacturer, setManufacturer] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

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
      charging_power_kw: m.charging_power_kw?.toString() ?? "",
      range_km: m.range_km?.toString() ?? "",
      max_towing_weight_braked_kg: m.max_towing_weight_braked_kg?.toString() ?? "",
      length_m: m.length_m?.toString() ?? "",
      width_m: "",
      height_m: "",
      weight_kg: "",
    });
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form
      action={async (formData) => {
        await addVehicle(formData);
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
          Ladeleistung (kW)
          <input
            name="charging_power_kw"
            type="number"
            step="0.1"
            min="0"
            value={form.charging_power_kw}
            onChange={(e) => updateField("charging_power_kw", e.target.value)}
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
          Max. Anhängelast gebremst (kg)
          <input
            name="max_towing_weight_braked_kg"
            type="number"
            step="1"
            min="0"
            value={form.max_towing_weight_braked_kg}
            onChange={(e) => updateField("max_towing_weight_braked_kg", e.target.value)}
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

        <label className="flex flex-col gap-1 text-sm">
          Fahrzeugbreite (m)
          <input
            name="width_m"
            type="number"
            step="0.01"
            min="0"
            value={form.width_m}
            onChange={(e) => updateField("width_m", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fahrzeughöhe (m)
          <input
            name="height_m"
            type="number"
            step="0.01"
            min="0"
            value={form.height_m}
            onChange={(e) => updateField("height_m", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Fahrzeuggewicht (kg)
          <input
            name="weight_kg"
            type="number"
            step="1"
            min="0"
            value={form.weight_kg}
            onChange={(e) => updateField("weight_kg", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-black/40 dark:text-white/40">
        Breite/Höhe/Gewicht sind optional, ermöglichen aber zusammen mit den
        Wohnwagen-Maßen eine Warnung vor bekannten Straßenrestriktionen
        (Höhen-/Breiten-/Gewichtsbeschränkungen) bei der Routenplanung.
      </p>

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
