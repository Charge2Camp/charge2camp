"use client";

import { useState } from "react";
import { setPreferredChargingProviders } from "@/app/profil/actions";
import { CHARGING_PROVIDERS } from "@/lib/charging-providers";

/** Bevorzugte Lade-Anbieter (Nutzerwunsch, ganz unten auf "Mein Gespann"):
 * feste Checkbox-Auswahl aus den zehn groessten/verbreitetsten Anbietern
 * (charging-providers.ts). Dient dem Routenplaner als Standardauswahl fuer
 * den dortigen Anbieter-Filter (route-planner-form.tsx). */
export function PreferredProvidersForm({ initialSelected }: { initialSelected: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setSaved(false);
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <form
      action={async (formData) => {
        setSaving(true);
        try {
          await setPreferredChargingProviders(formData);
          setSaved(true);
        } finally {
          setSaving(false);
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {CHARGING_PROVIDERS.map((p) => (
          <label key={p.key} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="preferred_providers"
              value={p.key}
              checked={selected.includes(p.key)}
              onChange={() => toggle(p.key)}
            />
            {p.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-50"
        >
          Speichern
        </button>
        {saved && <span className="text-sm text-route">Gespeichert.</span>}
      </div>
    </form>
  );
}
