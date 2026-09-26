"use client";

import { useMemo, useState } from "react";
import { addVehicle, updateVehicle } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Vehicle, VehicleModel } from "@/types/database";

const EMPTY_FORM = {
  manufacturer: "",
  model: "",
  battery_capacity_kwh: "",
  consumption_kwh_per_100km: "",
  charging_power_kw: "",
  range_km: "",
  length_m: "",
};

function vehicleToForm(vehicle: Vehicle): typeof EMPTY_FORM {
  return {
    manufacturer: vehicle.manufacturer,
    model: vehicle.model,
    battery_capacity_kwh: vehicle.battery_capacity_kwh.toString(),
    consumption_kwh_per_100km: vehicle.consumption_kwh_per_100km?.toString() ?? "",
    charging_power_kw: vehicle.charging_power_kw?.toString() ?? "",
    range_km: vehicle.range_km?.toString() ?? "",
    length_m: vehicle.length_m?.toString() ?? "",
  };
}

/** Dasselbe Formular fuer Neuanlegen (`vehicle` weggelassen, z. B. im
 * "Elektroauto hinzufügen"-Bereich) UND Bearbeiten eines bestehenden
 * Fahrzeugs (`vehicle` gesetzt, siehe vehicle-edit-dialog.tsx) -- vermeidet
 * doppelte Hersteller/Modell-Auswahl- und Feld-Logik fuer beide Faelle.
 * `onSaved` wird nur im Bearbeiten-Modus gebraucht (schliesst das Pop-up). */
export function VehicleForm({
  models,
  vehicle,
  onSaved,
}: {
  models: VehicleModel[];
  vehicle?: Vehicle;
  onSaved?: () => void;
}) {
  const isEdit = vehicle !== undefined;
  const [manufacturer, setManufacturer] = useState(vehicle?.manufacturer ?? "");
  const [selectedId, setSelectedId] = useState(vehicle?.model_reference_id ?? "");
  const [form, setForm] = useState(vehicle ? vehicleToForm(vehicle) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte.
  const [pending, setPending] = useState(false);

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
        setPending(true);
        try {
          const result = isEdit ? await updateVehicle(vehicle.id, formData) : await addVehicle(formData);
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
        } finally {
          setPending(false);
        }
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
                {m.model} {m.variant}
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

        <Field label="Batteriegröße (kWh) *">
          <Input
            name="battery_capacity_kwh"
            type="number"
            step="0.1"
            min="0"
            required
            value={form.battery_capacity_kwh}
            onChange={(e) => updateField("battery_capacity_kwh", e.target.value)}
          />
        </Field>

        <Field label="Verbrauch (kWh/100km)">
          <Input
            name="consumption_kwh_per_100km"
            type="number"
            step="0.1"
            min="0"
            value={form.consumption_kwh_per_100km}
            onChange={(e) => updateField("consumption_kwh_per_100km", e.target.value)}
          />
        </Field>

        <Field label="Ladeleistung (kW, optional)">
          <Input
            name="charging_power_kw"
            type="number"
            step="1"
            min="0"
            value={form.charging_power_kw}
            onChange={(e) => updateField("charging_power_kw", e.target.value)}
          />
        </Field>

        <Field label="Reichweite (km)">
          <Input
            name="range_km"
            type="number"
            step="1"
            min="0"
            value={form.range_km}
            onChange={(e) => updateField("range_km", e.target.value)}
          />
        </Field>

        <Field label="Fahrzeuglänge (m)">
          <Input
            name="length_m"
            type="number"
            step="0.01"
            min="0"
            value={form.length_m}
            onChange={(e) => updateField("length_m", e.target.value)}
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
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Wird gespeichert…" : isEdit ? "Speichern" : "Elektroauto hinzufügen"}
        </Button>
      </div>
    </form>
  );
}
