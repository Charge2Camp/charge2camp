import Link from "next/link";
import {
  AMENITY_FIELDS,
  AMENITY_LABELS,
  EV_FIELDS,
  EV_LABELS,
  type CampsiteFilters,
} from "@/lib/campsites";

export function CampsiteFilterForm({
  filters,
  countries,
  regions,
}: {
  filters: CampsiteFilters;
  countries: string[];
  regions: string[];
}) {
  return (
    <form className="flex flex-col gap-5 text-sm" action="/campingplaetze">
      <label className="flex flex-col gap-1">
        Suche
        <input
          type="text"
          name="q"
          defaultValue={filters.q}
          placeholder="Name des Campingplatzes"
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Land
          <select
            name="country"
            defaultValue={filters.country ?? ""}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Alle</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Region
          <select
            name="region"
            defaultValue={filters.region ?? ""}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Alle</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Umgebung &amp; Ausstattung</legend>
        {AMENITY_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={field}
              value="1"
              defaultChecked={filters.amenities.includes(field)}
            />
            {AMENITY_LABELS[field]}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Elektromobilität</legend>
        {EV_FIELDS.map((field) => (
          <label key={field} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={field}
              value="1"
              defaultChecked={filters.ev.includes(field)}
            />
            {EV_LABELS[field]}
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
          href="/campingplaetze"
          className="rounded-md border border-black/10 px-4 py-2 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Zurücksetzen
        </Link>
      </div>
    </form>
  );
}
