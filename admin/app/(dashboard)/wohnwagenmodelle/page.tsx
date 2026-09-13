import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { CaravanModel } from "@/lib/types";

const PAGE_SIZE = 50;

export default async function CaravanModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = createServiceClient();

  let query = supabase
    .from("caravan_models")
    .select("id, manufacturer, model, series, length_m, weight_kg, verification_status", { count: "exact" });
  if (q) query = query.or(`manufacturer.ilike.%${q}%,model.ilike.%${q}%,series.ilike.%${q}%`);

  const { data, count } = await query
    .order("manufacturer")
    .order("model")
    .order("series")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const models = (data ?? []) as Pick<
    CaravanModel,
    "id" | "manufacturer" | "model" | "series" | "length_m" | "weight_kg" | "verification_status"
  >[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wohnwagenmodelle</h1>
        <Link
          href="/wohnwagenmodelle/neu"
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium hover:bg-action-hover"
        >
          + Modell hinzufügen
        </Link>
      </div>
      <p className="text-sm text-text-muted">
        {count ?? 0} Modelle im Katalog -- Grundlage für die Autofill-Auswahl im Routenplaner-Profil der Haupt-App.
      </p>

      <form className="flex gap-2" action="/wohnwagenmodelle">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Hersteller, Modell oder Serie suchen…"
          className="min-h-11 flex-1 rounded-md border border-line px-3 py-2 text-base"
        />
        <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
          Suchen
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/wohnwagenmodelle/${m.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
          >
            <div>
              <p className="font-medium">
                {m.manufacturer} {m.model} {m.series ? `(${m.series})` : ""}
              </p>
              <p className="text-text-muted">
                {m.length_m} m lang · {m.weight_kg} kg
              </p>
            </div>
            {m.verification_status === "unverified" && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-text-muted">ungeprüft</span>
            )}
          </Link>
        ))}
        {models.length === 0 && <p className="text-sm text-text-muted">Keine Treffer.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/wohnwagenmodelle?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`}>
              ← Zurück
            </Link>
          )}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/wohnwagenmodelle?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`}>
              Weiter →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
