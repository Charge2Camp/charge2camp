"use client";

import { useMemo, useState } from "react";
import { addCaravan } from "@/app/profil/actions";
import type { CaravanModel } from "@/types/database";

const EMPTY_FORM = {
  manufacturer: "",
  model: "",
  length_m: "",
  width_m: "",
  height_m: "",
  weight_kg: "",
  gross_vehicle_weight_kg: "",
  actual_travel_weight_kg: "",
};

export function CaravanForm({ models }: { models: CaravanModel[] }) {
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
      model: m.series ? `${m.model} (${m.series})` : m.model,
      length_m: m.length_m.toString(),
      width_m: m.width_m.toString(),
      height_m: m.height_m.toString(),
      weight_kg: m.weight_kg.toString(),
      gross_vehicle_weight_kg: m.gross_vehicle_weight_kg?.toString() ?? "",
      actual_travel_weight_kg: "",
    });
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form
      action={async (formData) => {
        await addCaravan(formData);
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
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
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
            className="rounded-md border border-black/15 px-3 py-2 disabled:opacity-50 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Manuell eingeben…</option>
            {modelsForManufacturer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model} {m.series ? `(${m.series})` : ""}
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
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Modell *
          <input
            name="model"
            required
            value={form.model}
            onChange={(e) => updateField("model", e.target.value)}
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
            value={form.length_m}
            onChange={(e) => updateField("length_m", e.target.value)}
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
            value={form.width_m}
            onChange={(e) => updateField("width_m", e.target.value)}
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
            value={form.height_m}
            onChange={(e) => updateField("height_m", e.target.value)}
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
            value={form.weight_kg}
            onChange={(e) => updateField("weight_kg", e.target.value)}
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
            value={form.gross_vehicle_weight_kg}
            onChange={(e) => updateField("gross_vehicle_weight_kg", e.target.value)}
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
            value={form.actual_travel_weight_kg}
            onChange={(e) => updateField("actual_travel_weight_kg", e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      <div>
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
