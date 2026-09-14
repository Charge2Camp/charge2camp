import type { CaravanModel } from "@/lib/types";

/** Siehe fahrzeugmodelle/vehicle-model-form.tsx -- gleiches Prinzip. */
export function CaravanModelForm({
  caravan,
  action,
  submitLabel,
}: {
  caravan?: CaravanModel;
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
            defaultValue={caravan?.manufacturer ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Modell *
          <input
            name="model"
            required
            defaultValue={caravan?.model ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Baureihe / Serie
        <input
          name="series"
          defaultValue={caravan?.series ?? ""}
          placeholder="optional, z. B. „SUMMER EDITION“"
          className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Länge (m) *
          <input
            type="number"
            step="0.01"
            min="0"
            name="length_m"
            required
            defaultValue={caravan?.length_m ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Breite (m) *
          <input
            type="number"
            step="0.01"
            min="0"
            name="width_m"
            required
            defaultValue={caravan?.width_m ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Höhe (m) *
          <input
            type="number"
            step="0.01"
            min="0"
            name="height_m"
            required
            defaultValue={caravan?.height_m ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Quelle
          <input
            name="source"
            defaultValue={caravan?.source ?? "manual"}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prüfstatus
          <select
            name="verification_status"
            defaultValue={caravan?.verification_status ?? "unverified"}
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
