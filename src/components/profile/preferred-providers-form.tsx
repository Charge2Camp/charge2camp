"use client";

import { useState } from "react";
import { setPreferredChargingProviders } from "@/app/profil/actions";
import { CHARGING_PROVIDERS } from "@/lib/charging-providers";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

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
  const [error, setError] = useState<string | null>(null);

  function togglePreferred(key: string) {
    setSaved(false);
    setError(null);
    setPreferred((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setAvoided((prev) => prev.filter((k) => k !== key));
  }

  function toggleAvoided(key: string) {
    setSaved(false);
    setError(null);
    setAvoided((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPreferred((prev) => prev.filter((k) => k !== key));
  }

  return (
    <form
      // Bewusst onSubmit+preventDefault statt des `action`-Props: React
      // ruft nach einer Form-Action per `action`-Prop automatisch
      // form.reset() auf (native Formular-Semantik) -- das setzt die
      // Checkbox-DOM-Elemente direkt auf ungeprueft zurueck, OHNE dass sich
      // der React-State (preferred/avoided) aendert. Die Checkboxen bleiben
      // dadurch trotz `checked={...}` optisch leer, bis irgendein anderer
      // State-Change ein Re-Render dieser Inputs erzwingt (Bugreport: Haken
      // verschwindet direkt nach "Speichern", ist aber nach Neuladen wieder
      // da, weil der Speichervorgang selbst korrekt funktioniert hat).
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        const formData = new FormData(e.currentTarget);
        const result = await setPreferredChargingProviders(formData);
        if (result.ok) {
          setSaved(true);
        } else {
          setError(result.error);
        }
        setSaving(false);
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col divide-y divide-line rounded-md border border-line-strong">
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
              <label className="flex min-h-11 items-center gap-1.5 text-sm text-error">
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
        <Button type="submit" disabled={saving}>
          Speichern
        </Button>
        {saved && <span className="text-sm text-route">Gespeichert.</span>}
        {error && <FormError className="text-sm">{error}</FormError>}
      </div>
    </form>
  );
}
