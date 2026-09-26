"use client";

import { useMemo, useState } from "react";
import { addCaravan, updateCaravan } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Caravan, CaravanModel } from "@/types/database";

const EMPTY_FORM = {
  manufacturer: "",
  model: "",
  length_m: "",
  width_m: "",
  height_m: "",
};

function caravanToForm(caravan: Caravan): typeof EMPTY_FORM {
  return {
    manufacturer: caravan.manufacturer,
    model: caravan.model,
    length_m: caravan.length_m.toString(),
    width_m: caravan.width_m.toString(),
    height_m: caravan.height_m.toString(),
  };
}

/** Siehe VehicleForm -- gleiches Prinzip: Neuanlegen (`caravan` weggelassen)
 * und Bearbeiten (`caravan` gesetzt, siehe caravan-edit-dialog.tsx) teilen
 * sich dieselbe Feld-Logik. */
export function CaravanForm({
  models,
  caravan,
  onSaved,
}: {
  models: CaravanModel[];
  caravan?: Caravan;
  onSaved?: () => void;
}) {
  const isEdit = caravan !== undefined;
  const [manufacturer, setManufacturer] = useState(caravan?.manufacturer ?? "");
  const [selectedId, setSelectedId] = useState(caravan?.model_reference_id ?? "");
  const [form, setForm] = useState(caravan ? caravanToForm(caravan) : EMPTY_FORM);
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
      length_m: m.length_m.toString(),
      width_m: m.width_m.toString(),
      height_m: m.height_m.toString(),
    });
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = isEdit ? await updateCaravan(caravan.id, formData) : await addCaravan(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (isEdit) {
          onSaved?.();
          return;
        }
        setManufacturer("");
        setSelectedId("");
        setForm(EMPTY_FORM);
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Hersteller auswählen">
          <Select
            value={manufacturer}
            onChange={(e) => handleManufacturerSelect(e.target.value)}
            className="min-h-11"
          >
            <option value="">Manuell eingeben…</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Modell auswählen (füllt die Felder unten automatisch aus)">
          <Select
            value={selectedId}
            onChange={(e) => handleModelSelect(e.target.value)}
            disabled={!manufacturer}
            className="min-h-11"
          >
            <option value="">Manuell eingeben…</option>
            {modelsForManufacturer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <input type="hidden" name="model_reference_id" value={selectedId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Hersteller *">
          <Input
            name="manufacturer"
            required
            value={form.manufacturer}
            onChange={(e) => updateField("manufacturer", e.target.value)}
          />
        </Field>

        <Field label="Modell *">
          <Input
            name="model"
            required
            value={form.model}
            onChange={(e) => updateField("model", e.target.value)}
          />
        </Field>

        <Field label="Länge (m) *">
          <Input
            name="length_m"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.length_m}
            onChange={(e) => updateField("length_m", e.target.value)}
          />
        </Field>

        <Field label="Breite (m) *">
          <Input
            name="width_m"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.width_m}
            onChange={(e) => updateField("width_m", e.target.value)}
          />
        </Field>

        <Field label="Höhe (m) *">
          <Input
            name="height_m"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.height_m}
            onChange={(e) => updateField("height_m", e.target.value)}
          />
        </Field>
      </div>

      {!isEdit && !selectedId && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="suggest_new_model" className="mt-1 h-4 w-4" />
          <span>
            Dieses Modell fehlt noch in unserer Liste? Als neues Modell vorschlagen, damit wir es prüfen und für
            andere Nutzer ergänzen.
          </span>
        </label>
      )}

      {error && <FormError className="text-sm">{error}</FormError>}

      <div>
        <Button type="submit" size="md">
          {isEdit ? "Speichern" : "Wohnwagen hinzufügen"}
        </Button>
      </div>
    </form>
  );
}
