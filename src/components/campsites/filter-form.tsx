import Link from "next/link";
import { NameSuggestField } from "@/components/name-suggest-field";
import type { CampsiteFilters } from "@/lib/campsites";
import type { CoreAmenity } from "@/types/database";

/** Merkmale nach Kategorie gruppiert -- bei 30 Eintraegen ist eine flache
 * Liste unuebersichtlich (siehe core.amenity, Migration
 * 20260913000100_data_layer_seed_amenities). */
function groupByCategory(amenities: CoreAmenity[]): Map<string, CoreAmenity[]> {
  const groups = new Map<string, CoreAmenity[]>();
  for (const amenity of amenities) {
    if (amenity.value_type !== "bool") continue; // nur Ja/Nein-Merkmale als Checkbox filterbar
    const list = groups.get(amenity.category) ?? [];
    list.push(amenity);
    groups.set(amenity.category, list);
  }
  return groups;
}

const CATEGORY_LABELS: Record<string, string> = {
  lage: "Lage",
  wasser: "Wasser & Pool",
  familie: "Familie",
  infra: "Infrastruktur",
  stellplatz: "Stellplatz",
  laden: "Elektromobilität",
  sonstig: "Sonstiges",
};

export function CampsiteFilterForm({
  filters,
  countries,
  amenityCatalog,
  nameOptions,
}: {
  filters: CampsiteFilters;
  countries: string[];
  amenityCatalog: CoreAmenity[];
  /** Alle Campingplatz-Namen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
}) {
  const groups = groupByCategory(amenityCatalog);

  return (
    <form className="flex flex-col gap-5 text-sm" action="/campingplaetze">
      <label className="flex flex-col gap-1">
        Suche
        <NameSuggestField
          name="q"
          defaultValue={filters.q}
          placeholder="Name des Campingplatzes"
          options={nameOptions}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        Land
        <select
          name="country"
          defaultValue={filters.country ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
        Lademöglichkeit
        <select
          name="charging"
          defaultValue={filters.charging ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        >
          <option value="">Egal</option>
          <option value="on_site">Auf dem Platz</option>
          <option value="walking">Fußläufig erreichbar</option>
        </select>
      </label>

      {Array.from(groups.entries()).map(([category, amenities]) => (
        <fieldset key={category} className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{CATEGORY_LABELS[category] ?? category}</legend>
          {amenities.map((amenity) => (
            <label key={amenity.key} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name={amenity.key}
                value="1"
                defaultChecked={filters.amenities.includes(amenity.key)}
              />
              {amenity.label_de}
            </label>
          ))}
        </fieldset>
      ))}

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-12 rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Filtern
        </button>
        <Link
          href="/campingplaetze"
          className="flex min-h-12 items-center rounded-md border border-black/10 px-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Zurücksetzen
        </Link>
      </div>
    </form>
  );
}
