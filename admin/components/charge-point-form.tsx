"use client";

import { useState } from "react";

const CONNECTOR_STANDARDS = ["Type2", "CCS2", "CCS1", "CHAdeMO", "Schuko", "Type1", "Type2_Socket", "Tesla (Model S/X)", "NACS / Tesla Supercharger"];

const inputClass = "min-h-11 rounded-md border border-line px-3 py-2 text-base";

/** Geteiltes Stammdaten-/Anschluss-/Anhaengertauglichkeits-Formular --
 * urspruenglich nur fuer "Ladestation manuell anlegen"
 * (ladestationen/neu/page.tsx), jetzt auch fuer die Freigabe einer
 * Nutzer-Meldung (ladestationen/fehlende-saeulen/[reportId]/page.tsx)
 * genutzt, mit vorausgefuellten Koordinaten aus dem gemeldeten Link. `action`
 * und `submitLabel` sind austauschbar, die Feldstruktur bleibt fuer beide
 * Aufrufer identisch (siehe admin/lib/charge-point-write.ts, das beide
 * Formulare gegen dieselbe Schreiblogik ausliest). */
export function ChargePointForm({
  action,
  defaultValues,
  submitLabel = "Ladestation anlegen",
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: { latitude?: number | null; longitude?: number | null };
  submitLabel?: string;
}) {
  const [connectorRows, setConnectorRows] = useState(1);

  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Stammdaten</h2>
        <label className="flex flex-col gap-1 text-sm">
          Name *
          <input name="name" required placeholder="z. B. Energie Südbayern Ladepark" className={inputClass} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Betreiber
            <input name="operator" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Netzwerk
            <input name="network" className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Adresse
          <input name="address" placeholder="Straße und Hausnummer" className={inputClass} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            PLZ
            <input name="postcode" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Stadt
            <input name="city" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Land (ISO2)
            <input name="country_code" maxLength={2} placeholder="DE" className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Breitengrad (Latitude) *
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              name="latitude"
              required
              defaultValue={defaultValues?.latitude ?? ""}
              placeholder="47.7745"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Längengrad (Longitude) *
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              name="longitude"
              required
              defaultValue={defaultValues?.longitude ?? ""}
              placeholder="12.1233"
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-text-muted">
          Koordinaten z. B. per Rechtsklick auf den Standort bei{" "}
          <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" className="underline">
            openstreetmap.org
          </a>{" "}
          ermitteln.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Zugang
            <select name="access_type" defaultValue="" className={inputClass}>
              <option value="">Unbekannt</option>
              <option value="public">Öffentlich</option>
              <option value="restricted">Eingeschränkt</option>
              <option value="private">Privat</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:mt-6">
            <input type="checkbox" name="is_operational" value="1" defaultChecked />
            Betriebsbereit
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Anschlüsse</h2>
          <p className="mt-1 text-sm text-text-muted">
            Max. Ladeleistung und Anschlusszahl werden automatisch aus den Anschlüssen hier übernommen.
          </p>
        </div>
        <datalist id="connector-standards">
          {CONNECTOR_STANDARDS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {Array.from({ length: connectorRows }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 rounded-md border border-line p-3 sm:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
              Steckertyp
              <input name={`connector_standard_${i}`} list="connector-standards" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Leistung (kW)
              <input type="number" step="0.1" min="0" name={`connector_power_kw_${i}`} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Stromart
              <select name={`connector_current_type_${i}`} defaultValue="" className={inputClass}>
                <option value="">Unbekannt</option>
                <option value="AC">AC</option>
                <option value="DC">DC</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Anzahl
              <input type="number" step="1" min="1" name={`connector_quantity_${i}`} defaultValue="1" className={inputClass} />
            </label>
          </div>
        ))}
        {connectorRows < 6 && (
          <button
            type="button"
            onClick={() => setConnectorRows((n) => Math.min(6, n + 1))}
            className="min-h-11 self-start rounded-md border border-line px-4 text-sm font-medium hover:bg-line/20"
          >
            + Weiterer Anschluss
          </button>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Anhängertauglichkeit (optional)</h2>
        <label className="flex flex-col gap-1 text-sm">
          Einstufung
          <select name="verdict" defaultValue="unknown" className={inputClass}>
            <option value="yes">Anhängertauglich</option>
            <option value="unhitch">Nur abgekoppelt erreichbar</option>
            <option value="no">Nicht anhängertauglich</option>
            <option value="unknown">Ungeprüft</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="drive_through" value="1" />
          Drive-Through (durchfahrbar, kein Rangieren nötig)
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Rangierfläche
            <select name="maneuvering_space" defaultValue="" className={inputClass}>
              <option value="">Unbekannt</option>
              <option value="ample">Ausreichend</option>
              <option value="tight">Eng</option>
              <option value="none">Keine</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Einfahrlänge (m)
            <input type="number" step="0.1" min="0" name="pull_in_length_m" className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Notizen
          <textarea name="notes" rows={3} className="rounded-md border border-line px-3 py-2 text-base" />
        </label>
      </section>

      <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
        {submitLabel}
      </button>
    </form>
  );
}
