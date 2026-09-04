import Link from "next/link";
import type { ChargingStationFilters } from "@/lib/charging-stations";
import { TRAILER_SUITABILITY_LABELS, TRAILER_SUITABILITY_VALUES } from "@/lib/trailer-suitability";

export function ChargingStationFilterForm({
  filters,
  connectorTypes,
}: {
  filters: ChargingStationFilters;
  connectorTypes: string[];
}) {
  return (
    <form className="flex flex-col gap-5 text-sm" action="/ladepunkte">
      <label className="flex flex-col gap-1">
        Suche
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="Name des Ladepunkts"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        Steckertyp
        <select
          name="connector"
          defaultValue={filters.connectorType ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        >
          <option value="">Alle</option>
          {connectorTypes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="fast" value="1" defaultChecked={filters.fastChargersOnly} />
        Nur Schnelllader (≥100 kW)
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Anhängertauglichkeit</legend>
        {TRAILER_SUITABILITY_VALUES.map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={`trailer_${value}`}
              value="1"
              defaultChecked={filters.trailerSuitable.includes(value)}
            />
            {TRAILER_SUITABILITY_LABELS[value]}
          </label>
        ))}
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Filtern
        </button>
        <Link
          href="/ladepunkte"
          className="rounded-md border border-black/10 px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Zurücksetzen
        </Link>
      </div>
    </form>
  );
}
