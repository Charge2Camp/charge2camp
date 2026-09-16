import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { dismissChargePointDuplicate } from "./actions";

interface DuplicateRow {
  key_a: string;
  key_b: string;
  operator: string | null;
  distance_m: number;
}

interface StationLookup {
  id: string;
  external_key: string;
  name: string | null;
  operator: string | null;
  city: string | null;
  source: string;
  max_power_kw: number | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  return usp.toString();
}

const PAGE_SIZE = 50;

const SORT_OPTIONS = [
  { value: "power_desc", label: "Ladeleistung (hoch → niedrig)" },
  { value: "power_asc", label: "Ladeleistung (niedrig → hoch)" },
  { value: "distance_asc", label: "Entfernung (nah → fern)" },
] as const;

export default async function ChargePointDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; min_power?: string; sort?: string; merged?: string; dismissed?: string }>;
}) {
  const { page: pageParam, q, min_power: minPowerParam, sort, merged, dismissed } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const activeSort = SORT_OPTIONS.some((o) => o.value === sort) ? sort! : "power_desc";
  const minPower = minPowerParam ? Number(minPowerParam) : null;
  const supabase = createServiceClient();

  const { data: qualityRows, error: qualityError } = await supabase.schema("core").rpc("run_quality_checks");
  if (qualityError) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Qualitätscheck fehlgeschlagen: {qualityError.message}
        </p>
      </div>
    );
  }
  const rawDuplicates = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "duplicate_charge_points")
    .map((r) => r.data as DuplicateRow);

  const { data: dismissedRows, error: dismissedError } = await supabase
    .schema("core")
    .from("duplicate_dismissal")
    .select("key_a, key_b")
    .eq("entity_type", "charge_point");
  if (dismissedError) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Abgelehnte Paare konnten nicht geladen werden: {dismissedError.message}
        </p>
      </div>
    );
  }
  const dismissedSet = new Set((dismissedRows ?? []).map((d) => `${d.key_a}|${d.key_b}`));
  const undismissedDuplicates = rawDuplicates.filter((d) => {
    const lo = d.key_a < d.key_b ? d.key_a : d.key_b;
    const hi = d.key_a < d.key_b ? d.key_b : d.key_a;
    return !dismissedSet.has(`${lo}|${hi}`);
  });

  // Stationsdaten fuer ALLE (noch nicht abgelehnten) Paare aufloesen, nicht
  // nur die der aktuellen Seite -- Filtern/Sortieren nach Ladeleistung
  // (Nutzerwunsch: 100kW-Dubletten sind wichtiger zu pruefen als 11kW-
  // Dubletten) muss VOR der Seitenaufteilung passieren, sonst wuerden nur
  // die Treffer der zufaellig ersten 50 (unsortierten) Paare beruecksichtigt.
  const keys = Array.from(new Set(undismissedDuplicates.flatMap((d) => [d.key_a, d.key_b])));
  const stations: StationLookup[] = [];
  for (const batch of chunk(keys, 150)) {
    const { data, error } = await supabase
      .schema("core")
      .from("charge_point")
      .select("id, external_key, name, operator, city, source, max_power_kw")
      .in("external_key", batch);
    if (error) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/" className="text-sm text-text-muted hover:underline">
            ← Dashboard
          </Link>
          <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
            Ladepunkte konnten nicht geladen werden: {error.message}
          </p>
        </div>
      );
    }
    stations.push(...(data ?? []));
  }
  const byKey = new Map(stations.map((s) => [s.external_key, s]));

  const resolvedDuplicates = undismissedDuplicates
    .map((d) => ({ dup: d, a: byKey.get(d.key_a), b: byKey.get(d.key_b) }))
    .filter((r): r is { dup: DuplicateRow; a: StationLookup; b: StationLookup } => Boolean(r.a && r.b));

  const needle = q?.trim().toLowerCase();
  const filteredDuplicates = resolvedDuplicates.filter(({ dup, a, b }) => {
    if (minPower != null) {
      const maxKw = Math.max(a.max_power_kw ?? 0, b.max_power_kw ?? 0);
      if (maxKw < minPower) return false;
    }
    if (needle) {
      const haystack = [a.name, a.operator, a.city, b.name, b.operator, b.city, dup.operator]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sortedDuplicates = [...filteredDuplicates].sort((x, y) => {
    if (activeSort === "distance_asc") return x.dup.distance_m - y.dup.distance_m;
    const xKw = Math.max(x.a.max_power_kw ?? 0, x.b.max_power_kw ?? 0);
    const yKw = Math.max(y.a.max_power_kw ?? 0, y.b.max_power_kw ?? 0);
    return activeSort === "power_asc" ? xKw - yKw : yKw - xKw;
  });

  const totalPages = Math.max(1, Math.ceil(sortedDuplicates.length / PAGE_SIZE));
  const pageDuplicates = sortedDuplicates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const baseParams = { q, min_power: minPowerParam, sort: activeSort };
  // An die Zusammenfuehren-/Keine-Dublette-Aktionen durchgereicht, damit man
  // danach wieder bei denselben Filtern/derselben Seite landet, statt bei
  // Seite 1 ohne Filter (Nutzerfeedback).
  const returnQuery = buildQuery({ ...baseParams, page: String(page) });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mögliche Dubletten (Ladepunkte)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ladepunkte innerhalb von 25m mit übereinstimmendem Betreiber, aus core.run_quality_checks() --{" "}
          {resolvedDuplicates.length} gesamt, {sortedDuplicates.length} nach Filter. Pro Paar entscheidest du, welcher
          Datensatz bestehen bleibt.
        </p>
      </div>

      {(merged === "1" || dismissed === "1") && (
        <p className="rounded-md border border-route/40 bg-route/10 p-3 text-sm text-route">
          {merged === "1" ? "Zusammenführung erfolgreich." : "Als „Keine Dublette“ gespeichert."}
        </p>
      )}

      <form className="flex flex-col gap-2 rounded-md border border-line bg-card p-3" action="/ladestationen/dubletten">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, Betreiber oder Ort suchen…"
          className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <input
            type="number"
            name="min_power"
            defaultValue={minPowerParam}
            placeholder="Min. kW"
            min={0}
            step={1}
            className="min-h-11 rounded-md border border-line px-2 py-2 text-base"
          />
          <select name="sort" defaultValue={activeSort} className="min-h-11 rounded-md border border-line px-2 py-2 text-base">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Filtern
          </button>
          {(q || minPowerParam || (sort && sort !== "power_desc")) && (
            <Link
              href="/ladestationen/dubletten"
              className="flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-line/20"
            >
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {pageDuplicates.map(({ dup: d, a, b }, i) => {
          const maxKw = Math.max(a.max_power_kw ?? 0, b.max_power_kw ?? 0);
          return (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {a.name ?? a.operator ?? a.external_key} ({a.source}) ↔ {b.name ?? b.operator ?? b.external_key} ({b.source})
                </p>
                <p className="text-text-muted">
                  {[d.operator, a.city, `${d.distance_m}m Abstand`, maxKw ? `${maxKw} kW` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/ladestationen/dubletten/${a.id}/${b.id}?${returnQuery}`}
                  className="min-h-11 rounded-md bg-action px-3 py-2 text-sm font-medium leading-none hover:bg-action-hover"
                >
                  Zusammenführen
                </Link>
                <form action={dismissChargePointDuplicate.bind(null, d.key_a, d.key_b, returnQuery)}>
                  <button
                    type="submit"
                    className="min-h-11 rounded-md border border-line px-3 py-2 text-sm font-medium leading-none hover:bg-line/20"
                  >
                    Keine Dublette
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {sortedDuplicates.length === 0 && <p className="text-sm text-text-muted">Keine Dubletten gefunden.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/ladestationen/dubletten?${buildQuery({ ...baseParams, page: String(page - 1) })}`}>← Zurück</Link>
          )}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/ladestationen/dubletten?${buildQuery({ ...baseParams, page: String(page + 1) })}`}>Weiter →</Link>
          )}
        </div>
      )}
    </div>
  );
}
