"use client";

import { useState } from "react";
import { setPreferredChargingProviders } from "@/app/profil/actions";
import { CHARGING_PROVIDERS } from "@/lib/charging-providers";

/** Anbieter-Praeferenzen fuer die Ladeplanung (Nutzerwunsch, ganz unten auf
 * "Mein Gespann"): feste Auswahl aus den zehn groessten/verbreitetsten
 * Anbietern (charging-providers.ts), je Anbieter zwei Checkboxen --
 * "Bevorzugen" (wird im Routenplaner vorgezogen) und "Vermeiden" (wird NIE
 * als Ladestopp vorgeschlagen, z. B. "nie Tesla einplanen"). Beide schliessen
 * sich pro Anbieter gegenseitig aus. Dient dem Routenplaner als
 * Standardauswahl fuer den dortigen Anbieter-Filter (route-planner-form.tsx). */
export function PreferredProvidersForm({
  initialPreferred,
  initialAvoided,
}: {
  initialPreferred: string[];
  initialAvoided: string[];
}) {
  const [preferred, setPreferred] = useState<string[]>(initialPreferred);
  const [avoided, setAvoided] = useState<string[]>(initialAvoided);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function togglePreferred(key: string) {
    setSaved(false);
    setPreferred((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setAvoided((prev) => prev.filter((k) => k !== key));
  }

  function toggleAvoided(key: string) {
    setSaved(false);
    setAvoided((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPreferred((prev) => prev.filter((k) => k !== key));
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
      <div className="flex flex-col divide-y divide-black/10 rounded-md border border-black/15 dark:divide-white/10 dark:border-white/15">
        {CHARGING_PROVIDERS.map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-sm">{p.label}</span>
            <div className="flex shrink-0 gap-3">
              <label className="flex min-h-11 items-center gap-1.5 text-sm text-route">
                <input
                  type="checkbox"
                  name="preferred_providers"
                  value={p.key}
                  checked={preferred.includes(p.key)}
                  onChange={() => togglePreferred(p.key)}
                />
                Bevorzugen
              </label>
              <label className="flex min-h-11 items-center gap-1.5 text-sm text-red-600">
                <input
                  type="checkbox"
                  name="avoided_providers"
                  value={p.key}
                  checked={avoided.includes(p.key)}
                  onChange={() => toggleAvoided(p.key)}
                />
                Vermeiden
              </label>
            </div>
          </div>
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
