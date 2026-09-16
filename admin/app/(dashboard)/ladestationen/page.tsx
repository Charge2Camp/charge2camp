import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { StationListWithBulkEdit } from "./station-list";

const DEFAULT_PAGE_SIZE = 30;
// Massen-Bearbeitung (siehe station-list.tsx) ist nur fuer Treffer auf der
// aktuell geladenen Seite moeglich -- bei einer breiten Suche (z.B. Betreiber
// "ladenetz.de" ueber ganz Deutschland) braucht man dafuer mehr als die
// sonst uebliche Seitengroesse von 30 auf einmal sichtbar.
const PAGE_SIZE_OPTIONS = [30, 100, 300] as const;

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "power_desc", label: "Ladeleistung (hoch → niedrig)" },
  { value: "power_asc", label: "Ladeleistung (niedrig → hoch)" },
  { value: "country_asc", label: "Land (A–Z)" },
  { value: "last_seen_desc", label: "Zuletzt gesehen" },
] as const;

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

function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  return usp.toString();
}

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    city?: string;
    page?: string;
    country?: string;
    operator?: string;
    verdict?: string;
    min_power?: string;
    sort?: string;
    page_size?: string;
  }>;
}) {
  const { q, city, page: pageParam, country, operator, verdict, min_power: minPower, sort, page_size: pageSizeParam } =
    await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const activeSort = SORT_OPTIONS.some((o) => o.value === sort) ? sort! : "name_asc";
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(pageSizeParam) as (typeof PAGE_SIZE_OPTIONS)[number])
    ? Number(pageSizeParam)
    : DEFAULT_PAGE_SIZE;
  const supabase = createServiceClient();

  const [{ data: rows, error }, { data: optionsRows }] = await Promise.all([
    supabase.schema("core").rpc("charge_point_admin_list", {
      p_q: q || null,
      p_city: city || null,
      p_country_code: country || null,
      p_operator: operator || null,
      p_verdict: verdict || null,
      p_min_power_kw: minPower ? Number(minPower) : null,
      p_sort: activeSort,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    supabase.schema("core").rpc("charge_point_filter_options"),
  ]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Ladestationen</h1>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Liste konnte nicht geladen werden: {error.message}
        </p>
      </div>
    );
  }

  const stations = (rows ?? []) as AdminListRow[];
  const totalCount = stations[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const options = (optionsRows?.[0] ?? { countries: [], operators: [] }) as {
    countries: string[] | null;
    operators: string[] | null;
  };

  const baseParams = {
    q,
    city,
    country,
    operator,
    verdict,
    min_power: minPower,
    sort: activeSort,
    page_size: String(pageSize),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ladestationen</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-text-muted">{totalCount} gesamt</p>
          <Link
            href="/ladestationen/neu"
            className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium leading-none hover:bg-action-hover"
          >
            + Neu anlegen
          </Link>
        </div>
      </div>

      <form className="flex flex-col gap-2 rounded-md border border-line bg-card p-3" action="/ladestationen">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Name oder Betreiber suchen…"
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
          <input
            type="text"
            name="city"
            defaultValue={city}
            placeholder="Stadt suchen…"
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          <select name="country" defaultValue={country ?? ""} className="min-h-11 rounded-md border border-line px-2 py-2 text-base">
            <option value="">Alle Länder</option>
            {(options.countries ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="operator" defaultValue={operator ?? ""} className="min-h-11 rounded-md border border-line px-2 py-2 text-base">
            <option value="">Alle Anbieter</option>
            {(options.operators ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select name="verdict" defaultValue={verdict ?? ""} className="min-h-11 rounded-md border border-line px-2 py-2 text-base">
            <option value="">Geprüft & ungeprüft</option>
            <option value="checked">Nur geprüft</option>
            <option value="unchecked">Nur ungeprüft</option>
          </select>
          <input
            type="number"
            name="min_power"
            defaultValue={minPower}
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
          <select name="page_size" defaultValue={String(pageSize)} className="min-h-11 rounded-md border border-line px-2 py-2 text-base">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} pro Seite
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Filtern
          </button>
          {(q || city || country || operator || verdict || minPower || (sort && sort !== "name_asc")) && (
            <Link
              href="/ladestationen"
              className="flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-line/20"
            >
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>

      <StationListWithBulkEdit stations={stations} />

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/ladestationen?${buildQuery({ ...baseParams, page: String(page - 1) })}`}>← Zurück</Link>}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/ladestationen?${buildQuery({ ...baseParams, page: String(page + 1) })}`}>Weiter →</Link>
          )}
        </div>
      )}
    </div>
  );
}
