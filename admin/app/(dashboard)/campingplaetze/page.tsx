import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { Campsite } from "@/lib/types";

const PAGE_SIZE = 30;

export default async function CampsitesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = createServiceClient();

  let query = supabase.schema("core").from("campsite").select("id, name, city, country_code, is_active", { count: "exact" });
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, count } = await query.order("name").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const campsites = (data ?? []) as Pick<Campsite, "id" | "name" | "city" | "country_code" | "is_active">[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campingplätze</h1>
        <p className="text-sm text-text-muted">{count ?? 0} gesamt</p>
      </div>

      <form className="flex gap-2" action="/campingplaetze">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name suchen…"
          className="min-h-11 flex-1 rounded-md border border-line px-3 py-2 text-base"
        />
        <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
          Suchen
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {campsites.map((c) => (
          <Link
            key={c.id}
            href={`/campingplaetze/${c.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
          >
            <p className="font-medium">{c.name}</p>
            <div className="flex items-center gap-2">
              {!c.is_active && (
                <span className="rounded bg-status-down/10 px-2 py-0.5 text-xs font-medium text-status-down">deaktiviert</span>
              )}
              <p className="text-text-muted">{[c.city, c.country_code].filter(Boolean).join(", ")}</p>
            </div>
          </Link>
        ))}
        {campsites.length === 0 && <p className="text-sm text-text-muted">Keine Treffer.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/campingplaetze?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}>← Zurück</Link>
          )}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/campingplaetze?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}>Weiter →</Link>
          )}
        </div>
      )}
    </div>
  );
}
