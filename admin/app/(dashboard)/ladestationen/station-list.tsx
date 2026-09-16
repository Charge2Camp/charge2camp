"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { bulkUpdateChargePoints, type BulkEditableField } from "./actions";

interface AdminListRow {
  id: string;
  external_key: string;
  name: string | null;
  operator: string | null;
  city: string | null;
  country_code: string | null;
  max_power_kw: number | null;
  is_operational: boolean | null;
  is_active: boolean;
  verdict: string;
  total_count: number;
}

const VERDICT_LABELS: Record<string, string> = {
  yes: "Anhängertauglich",
  unhitch: "Nur abgekoppelt",
  no: "Nicht tauglich",
  unknown: "Ungeprüft",
};

const FIELD_OPTIONS: { value: BulkEditableField; label: string }[] = [
  { value: "operator", label: "Betreiber" },
  { value: "access_type", label: "Zugang" },
  { value: "country_code", label: "Land (ISO2)" },
  { value: "is_operational", label: "Betriebsbereit" },
];

/** Massen-Bearbeitung (Nutzerwunsch): mehrere Stationen per Checkbox
 * auswaehlen, EIN Feld/Wert festlegen, nach Bestaetigung wird das bei ALLEN
 * ausgewaehlten Stationen ueberschrieben (z.B. Betreiber "ladenetz.de" ->
 * "Stadtwerke Muenchen" bei allen faelschlich zugeordneten Treffern einer
 * Suche in einem Schritt). Auswahl gilt nur fuer die aktuell geladene
 * Seite/Filterung -- bei Bedarf zuerst ueber die Filter/„Pro Seite"-Auswahl
 * auf der Seite darueber alle relevanten Treffer sichtbar machen. */
export function StationListWithBulkEdit({ stations }: { stations: AdminListRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [field, setField] = useState<BulkEditableField>("operator");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedStations = useMemo(() => stations.filter((s) => selected.has(s.id)), [stations, selected]);
  const allOnPageSelected = stations.length > 0 && stations.every((s) => selected.has(s.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        for (const s of stations) next.delete(s.id);
        return next;
      }
      const next = new Set(prev);
      for (const s of stations) next.add(s.id);
      return next;
    });
  }

  function fieldLabel(): string {
    return FIELD_OPTIONS.find((f) => f.value === field)?.label ?? field;
  }

  function valueLabel(): string {
    if (field === "is_operational") return value === "1" ? "Ja" : "Nein";
    return value;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (selectedStations.length === 0) return;

    const confirmed = window.confirm(
      `${fieldLabel()} bei ${selectedStations.length} ausgewählten Station(en) auf "${valueLabel()}" setzen?\n\n` +
        `Betroffen u. a.: ${selectedStations
          .slice(0, 5)
          .map((s) => s.name ?? s.operator ?? s.external_key)
          .join(", ")}${selectedStations.length > 5 ? ", …" : ""}`
    );
    if (!confirmed) return;

    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      await bulkUpdateChargePoints(fd);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Massen-Bearbeitung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 pb-20">
      <label className="flex min-h-11 items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
        Alle auf dieser Seite auswählen
      </label>

      {stations.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
        >
          <input
            type="checkbox"
            checked={selected.has(s.id)}
            onChange={() => toggleOne(s.id)}
            className="min-h-5 min-w-5"
            aria-label={`${s.name ?? s.operator ?? s.external_key} auswählen`}
          />
          <Link href={`/ladestationen/${s.id}`} className="flex flex-1 items-center justify-between gap-2">
            <div>
              <p className="font-medium">{s.name ?? s.operator ?? "(ohne Namen)"}</p>
              <p className="text-text-muted">
                {[s.city, s.country_code, s.operator, s.max_power_kw ? `${s.max_power_kw} kW` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!s.is_active && (
                <span className="rounded bg-status-down/10 px-2 py-0.5 text-xs font-medium text-status-down">deaktiviert</span>
              )}
              {!s.is_operational && <span className="rounded bg-status-down/10 px-2 py-0.5 text-xs text-status-down">außer Betrieb</span>}
              <span className="rounded-full border border-line px-2 py-0.5 text-xs">{VERDICT_LABELS[s.verdict] ?? s.verdict}</span>
            </div>
          </Link>
        </div>
      ))}
      {stations.length === 0 && <p className="text-sm text-text-muted">Keine Treffer.</p>}

      {selected.size > 0 && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-base p-3 text-text-inverse shadow-lg sm:flex-row sm:items-center sm:gap-3"
        >
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="station_id" value={id} />
          ))}
          <p className="whitespace-nowrap text-sm font-medium">{selected.size} ausgewählt</p>
          <select
            name="field"
            value={field}
            onChange={(e) => setField(e.target.value as BulkEditableField)}
            className="min-h-11 rounded-md border border-line bg-card px-2 py-2 text-base text-text"
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          {field === "is_operational" ? (
            <select
              name="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="min-h-11 rounded-md border border-line bg-card px-2 py-2 text-base text-text"
            >
              <option value="">– auswählen –</option>
              <option value="1">Ja</option>
              <option value="0">Nein</option>
            </select>
          ) : field === "access_type" ? (
            <select
              name="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              className="min-h-11 rounded-md border border-line bg-card px-2 py-2 text-base text-text"
            >
              <option value="">– auswählen –</option>
              <option value="public">Öffentlich</option>
              <option value="restricted">Eingeschränkt</option>
              <option value="private">Privat</option>
            </select>
          ) : (
            <input
              type="text"
              name="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              maxLength={field === "country_code" ? 2 : undefined}
              placeholder={field === "country_code" ? "DE" : "Neuer Wert…"}
              className="min-h-11 flex-1 rounded-md border border-line bg-card px-3 py-2 text-base text-text sm:flex-none"
            />
          )}
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-md bg-action px-4 text-sm font-medium text-text hover:bg-action-hover disabled:opacity-50"
          >
            {pending ? "Wird übernommen…" : "Übernehmen"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-11 rounded-md border border-text-inverse/30 px-4 text-sm font-medium hover:bg-white/10"
          >
            Abbrechen
          </button>
          {error && <p className="text-sm text-status-down">{error}</p>}
        </form>
      )}
    </div>
  );
}
