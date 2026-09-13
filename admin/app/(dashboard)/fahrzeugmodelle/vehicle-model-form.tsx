import type { VehicleModel } from "@/lib/types";

/** Gemeinsames Formular fuer Neuanlegen (`model` weggelassen) und
 * Bearbeiten (`model` gesetzt) eines Fahrzeugmodell-Katalogeintrags --
 * server-seitig gerendert (kein Client-State noetig, anders als die
 * Haupt-App-Formulare, da es hier keine Hersteller/Modell-Autofill-
 * Kaskade gibt: dieses Formular IST der Katalog). */
export function VehicleModelForm({
  model,
  action,
  submitLabel,
}: {
  model?: VehicleModel;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Hersteller *
          <input
            name="manufacturer"
            required
            defaultValue={model?.manufacturer ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Modell *
          <input
            name="model"
            required
            defaultValue={model?.model ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Variante *
        <input
          name="variant"
          required
          defaultValue={model?.variant ?? ""}
          placeholder="z. B. „RWD 60 kWh“"
          className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Batteriegröße (kWh)
          <input
            type="number"
            step="0.1"
            min="0"
            name="battery_capacity_kwh"
            defaultValue={model?.battery_capacity_kwh ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Verbrauch (kWh/100km)
          <input
            type="number"
            step="0.1"
            min="0"
            name="consumption_kwh_per_100km"
            defaultValue={model?.consumption_kwh_per_100km ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ladeleistung (kW)
          <input
            type="number"
            step="1"
            min="0"
            name="charging_power_kw"
            defaultValue={model?.charging_power_kw ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Reichweite (km)
          <input
            type="number"
            step="1"
            min="0"
            name="range_km"
            defaultValue={model?.range_km ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fahrzeuglänge (m)
          <input
            type="number"
            step="0.01"
            min="0"
            name="length_m"
            defaultValue={model?.length_m ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Max. Anhängelast gebremst (kg)
          <input
            type="number"
            step="1"
            min="0"
            name="max_towing_weight_braked_kg"
            defaultValue={model?.max_towing_weight_braked_kg ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Quelle
          <input
            name="source"
            defaultValue={model?.source ?? "manual"}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prüfstatus
          <select
            name="verification_status"
            defaultValue={model?.verification_status ?? "unverified"}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          >
            <option value="unverified">Ungeprüft</option>
            <option value="verified">Geprüft</option>
            <option value="outdated">Veraltet</option>
          </select>
        </label>
      </div>
      <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
        {submitLabel}
      </button>
    </form>
  );
}
