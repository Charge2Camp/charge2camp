import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { ChargePoint, TrailerSuitability } from "@/lib/types";

const PAGE_SIZE = 30;

const VERDICT_LABELS: Record<string, string> = {
  yes: "Anhängertauglich",
  unhitch: "Nur abgekoppelt",
  no: "Nicht tauglich",
  unknown: "Ungeprüft",
};

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = createServiceClient();

  let query = supabase
    .schema("core")
    .from("charge_point")
    .select("id, external_key, name, operator, city, country_code, is_operational", { count: "exact" });
  if (q) query = query.or(`name.ilike.%${q}%,operator.ilike.%${q}%`);

  const { data, count } = await query
    .order("name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const stations = (data ?? []) as Pick<
    ChargePoint,
    "id" | "external_key" | "name" | "operator" | "city" | "country_code" | "is_operational"
  >[];

  const keys = stations.map((s) => s.external_key);
  const { data: trailerRows } =
    keys.length > 0
      ? await supabase.schema("enrich").from("trailer_suitability").select("charge_point_key, verdict").in("charge_point_key", keys)
      : { data: [] as Pick<TrailerSuitability, "charge_point_key" | "verdict">[] };
  const verdictByKey = new Map((trailerRows ?? []).map((t) => [t.charge_point_key, t.verdict]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ladestationen</h1>
        <p className="text-sm text-text-muted">{count ?? 0} gesamt</p>
      </div>

      <form className="flex gap-2" action="/ladestationen">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name oder Betreiber suchen…"
          className="min-h-11 flex-1 rounded-md border border-line px-3 py-2 text-base"
        />
        <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
          Suchen
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {stations.map((s) => {
          const verdict = verdictByKey.get(s.external_key);
          return (
            <Link
              key={s.id}
              href={`/ladestationen/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <div>
                <p className="font-medium">{s.name ?? s.operator ?? "(ohne Namen)"}</p>
                <p className="text-text-muted">{[s.city, s.country_code].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex items-center gap-2">
                {!s.is_operational && <span className="rounded bg-status-down/10 px-2 py-0.5 text-xs text-status-down">außer Betrieb</span>}
                {verdict && (
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs">
                    {VERDICT_LABELS[verdict] ?? verdict}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        {stations.length === 0 && <p className="text-sm text-text-muted">Keine Treffer.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/ladestationen?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}>
              ← Zurück
            </Link>
          )}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/ladestationen?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}>
              Weiter →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
