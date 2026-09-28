"use client";

import { useEffect, useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { FilterChip } from "@/components/charging-stations/filter-chip";
import { WheelPickerField, type WheelPickerOption } from "@/components/ui/wheel-picker";
import { DEFAULT_RADIUS_KM, EV_SCORE_MIN_OPTIONS, RADIUS_KM_OPTIONS } from "@/lib/campsite-filters";
import type { CampsiteFilters } from "@/lib/campsites";

/** Alle Elektromobilitaets-Merkmale aus core.amenity (Kategorie "laden":
 * "charging_on_site", "charging_at_pitch", "charging_dc") wurden bewusst
 * NICHT als eigene Chips uebernommen -- sie waren manuell/per OSM getaggte
 * Signale aus einer ANDEREN, unabhaengigen Datenquelle (core.campsite_amenity)
 * als die berechneten Lademoeglichkeit-Chips unten (core.campsite_search.
 * charging_on_site/walkable_ac_m/walkable_dc_m, aus der echten
 * Ladepunkt-Verknuepfung core.campsite_charge_link), fuer den Nutzer nicht
 * unterscheidbar und teils widerspruechlich (Audit-Befund 2026-09-28: "was
 * ist der Unterschied zu Lademoeglichkeit?"). Statt eigener Chips fliesst
 * "charging_at_pitch" seit Migration
 * 20261025090000_campsite_onsite_charging_includes_pitch_amenity.sql direkt
 * in die Berechnung von charging_on_site ein (Laden am Stellplatz zaehlt
 * als Laden auf dem Platz, Nutzeranfrage: EIN konsolidierter Filter statt
 * mehrerer sich ueberschneidender), s. docs/DESIGN_DECISIONS.md.
 */

const EV_SCORE_OPTIONS: WheelPickerOption<number>[] = EV_SCORE_MIN_OPTIONS.map((v) => ({
  label: v === 0 ? "Kein Minimum" : `≥ ${v}`,
  value: v,
}));

const RADIUS_OPTIONS: WheelPickerOption<number>[] = RADIUS_KM_OPTIONS.map((v) => ({
  label: `${v} km`,
  value: v,
}));

/** Stufen fuer die EV-Camping-Tauglichkeit (Community-Bewertung, core.
 * campsite_search.rating_avg) -- deriveCampsiteRating() liefert nur 1, 3, 4
 * oder 5 Sterne (nie 2), die Stufen orientieren sich daran. */
const RATING_MIN_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: "≥ 3 ★" },
  { value: 4, label: "≥ 4 ★" },
  { value: 5, label: "5 ★" },
];

/** Kernfilter der Campingplatzsuche, direkt auf der Seite sichtbar (kein
 * Formular-Submit mehr, siehe campsite-search-client.tsx applyFilters) --
 * jede Aenderung wirkt sofort, Karte/Liste passen sich live an, wie in der
 * Routenplanung/Ladepunkte-Suche. Reihenfolge nach Nutzeranfrage: Ort/
 * Umkreis, Land, Lademoeglichkeit, EV-Score, EV-Camping-Tauglichkeit, dann
 * die uebrigen Lademerkmale. */
export function CampsiteQuickFilters({
  filters,
  onChange,
  countries,
}: {
  filters: CampsiteFilters;
  onChange: (patch: Partial<CampsiteFilters>) => void;
  countries: string[];
}) {
  // Eigener Text-State fuers Adressfeld (siehe AddressAutocomplete-Kommentar):
  // `value` ist bewusst NICHT direkt an filters.near.label gebunden, sonst
  // waere das Feld waehrend der Eingabe unbeschreibbar. Der Effekt darunter
  // synchronisiert nur bei einer AEUSSEREN Aenderung (z. B. "Zuruecksetzen").
  const [addressText, setAddressText] = useState(filters.near?.label ?? "");
  useEffect(() => {
    void Promise.resolve().then(() => setAddressText(filters.near?.label ?? ""));
  }, [filters.near?.label]);

  function toggleCharging(value: NonNullable<CampsiteFilters["charging"]>) {
    onChange({ charging: filters.charging === value ? undefined : value });
  }

  function toggleRatingMin(value: number) {
    onChange({ ratingMin: filters.ratingMin === value ? undefined : value });
  }

  function selectAddressCoordinates(coords: { latitude: number; longitude: number } | null) {
    if (!coords) {
      onChange({ near: undefined, radiusKm: undefined });
      return;
    }
    onChange({ near: { ...coords, label: addressText }, radiusKm: filters.radiusKm ?? DEFAULT_RADIUS_KM });
  }

  function clearLocation() {
    setAddressText("");
    onChange({ near: undefined, radiusKm: undefined });
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          Ort oder Adresse
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <AddressAutocomplete
                name="near"
                value={addressText}
                onChange={setAddressText}
                onSelectCoordinates={selectAddressCoordinates}
                placeholder="z. B. Konstanz oder eine Adresse"
                className="w-full rounded-md border border-line-strong px-3 py-2 dark:bg-transparent"
              />
            </div>
            {filters.near && (
              <button
                type="button"
                onClick={clearLocation}
                aria-label="Ort entfernen"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong text-lg leading-none hover:bg-black/5 dark:hover:bg-white/10"
              >
                ×
              </button>
            )}
          </div>
        </label>

        {/* Der Radius ist ohne gewaehlten Ort bedeutungslos -- Progressive
            Disclosure statt eines dauerhaft sichtbaren, aber wirkungslosen
            Feldes. */}
        {filters.near && (
          <div className="max-w-[10rem]">
            <WheelPickerField
              label="Umkreis"
              options={RADIUS_OPTIONS}
              value={filters.radiusKm ?? DEFAULT_RADIUS_KM}
              onChange={(v) => onChange({ radiusKm: v })}
            />
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 sm:max-w-xs">
        Land
        <select
          value={filters.country ?? ""}
          onChange={(e) => onChange({ country: e.target.value || undefined })}
          className="min-h-12 rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        >
          <option value="">Alle</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Lademöglichkeit</legend>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Auf dem Platz"
            active={filters.charging === "on_site"}
            onClick={() => toggleCharging("on_site")}
          />
          <FilterChip
            label="AC fußläufig"
            active={filters.charging === "ac_walk"}
            onClick={() => toggleCharging("ac_walk")}
          />
          <FilterChip
            label="DC fußläufig"
            active={filters.charging === "dc_walk"}
            onClick={() => toggleCharging("dc_walk")}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="max-w-[14rem]">
          <WheelPickerField
            label="Mindest-EV-Score"
            options={EV_SCORE_OPTIONS}
            value={filters.evScoreMin ?? 0}
            onChange={(v) => onChange({ evScoreMin: v || undefined })}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">EV-Camping-Tauglichkeit</legend>
          <div className="flex flex-wrap gap-2">
            {RATING_MIN_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={filters.ratingMin === option.value}
                onClick={() => toggleRatingMin(option.value)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
