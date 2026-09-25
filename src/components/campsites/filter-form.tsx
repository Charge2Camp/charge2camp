import { NameSuggestField } from "@/components/name-suggest-field";
import type { CampsiteFilters } from "@/lib/campsites";
import type { CoreAmenity } from "@/types/database";

/** Merkmale nach Kategorie gruppiert -- bei 30 Eintraegen ist eine flache
 * Liste unuebersichtlich (siehe core.amenity, Migration
 * 20260913000100_data_layer_seed_amenities). Kategorie "laden"
 * (Elektromobilitaet) bewusst ausgeklammert -- die steht als Quick-Filter
 * direkt auf der Seite (siehe quick-filters.tsx), nicht hier im
 * "Weitere Filter"-Pop-up. */
function groupByCategory(amenities: CoreAmenity[]): Map<string, CoreAmenity[]> {
  const groups = new Map<string, CoreAmenity[]>();
  for (const amenity of amenities) {
    if (amenity.value_type !== "bool") continue; // nur Ja/Nein-Merkmale als Checkbox filterbar
    if (amenity.category === "laden") continue;
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
  sonstig: "Sonstiges",
};

/** "Weitere Filter" -- Suche + alle Merkmals-Kategorien ausser
 * Elektromobilitaet (siehe quick-filters.tsx) und Land (siehe
 * campingplaetze/page.tsx). Kein eigenes <form>: die Felder gehoeren zum
 * umschliessenden <form> in campingplaetze/page.tsx, damit ein Submit
 * Quick-Filter und "weitere Filter" gemeinsam anwendet, egal ob er aus dem
 * Pop-up oder von den Quick-Filtern ausgeloest wird. */
export function CampsiteFilterForm({
  filters,
  amenityCatalog,
  nameOptions,
}: {
  filters: CampsiteFilters;
  amenityCatalog: CoreAmenity[];
  /** Alle Campingplatz-Namen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
}) {
  const groups = groupByCategory(amenityCatalog);

  return (
    <div className="flex flex-col gap-5 text-sm">
      <label className="flex flex-col gap-1">
        Suche
        <NameSuggestField
          name="q"
          defaultValue={filters.q}
          placeholder="Name des Campingplatzes"
          options={nameOptions}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
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

      <button
        type="submit"
        className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover"
      >
        Filtern
      </button>
    </div>
  );
}
