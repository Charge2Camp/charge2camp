"use client";

import { FilterChip } from "@/components/charging-stations/filter-chip";
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
 * Elektromobilitaet (siehe quick-filters.tsx) und Land/Lademoeglichkeit/
 * EV-Score/Bewertung (ebenfalls quick-filters.tsx). Kein <form>/Submit mehr
 * (Umstellung auf Sofort-Filter, siehe campsite-search-client.tsx) -- jede
 * Aenderung wirkt sofort, das Sheet bleibt dabei offen. */
export function CampsiteFilterForm({
  filters,
  onChange,
  amenityCatalog,
  nameOptions,
}: {
  filters: CampsiteFilters;
  onChange: (patch: Partial<CampsiteFilters>) => void;
  amenityCatalog: CoreAmenity[];
  /** Alle Campingplatz-Namen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
}) {
  const groups = groupByCategory(amenityCatalog);

  function toggleAmenity(key: string) {
    const next = filters.amenities.includes(key)
      ? filters.amenities.filter((k) => k !== key)
      : [...filters.amenities, key];
    onChange({ amenities: next });
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <label className="flex flex-col gap-1">
        Suche
        <NameSuggestField
          value={filters.q ?? ""}
          onCommit={(value) => onChange({ q: value || undefined })}
          placeholder="Name des Campingplatzes"
          options={nameOptions}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
      </label>

      {Array.from(groups.entries()).map(([category, amenities]) => (
        <fieldset key={category} className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{CATEGORY_LABELS[category] ?? category}</legend>
          <div className="flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <FilterChip
                key={amenity.key}
                label={amenity.label_de}
                active={filters.amenities.includes(amenity.key)}
                onClick={() => toggleAmenity(amenity.key)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
