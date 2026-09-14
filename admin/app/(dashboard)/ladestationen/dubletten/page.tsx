import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

interface DuplicateRow {
  key_a: string;
  key_b: string;
  operator: string | null;
  distance_m: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const PAGE_SIZE = 50;

export default async function ChargePointDuplicatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
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
  const allDuplicates = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "duplicate_charge_points")
    .map((r) => r.data as DuplicateRow);

  const totalPages = Math.max(1, Math.ceil(allDuplicates.length / PAGE_SIZE));
  const duplicates = allDuplicates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Nur die auf dieser Seite sichtbaren Paare aufloesen (nicht alle 1000+
  // moeglichen Dubletten auf einmal) -- bei sehr vielen Treffern sprengt
  // ein einzelner .in()-Aufruf mit allen external_keys sonst die maximale
  // URI-Laenge (PostgREST kodiert Filter als Query-Parameter, siehe
  // gleiches Problem in src/app/api/cron/ocm-import/route.ts).
  const keys = Array.from(new Set(duplicates.flatMap((d) => [d.key_a, d.key_b])));
  const stations: { id: string; external_key: string; name: string | null; operator: string | null; city: string | null; source: string }[] = [];
  for (const batch of chunk(keys, 150)) {
    const { data, error } = await supabase
      .schema("core")
      .from("charge_point")
      .select("id, external_key, name, operator, city, source")
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mögliche Dubletten (Ladepunkte)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ladepunkte innerhalb von 25m mit übereinstimmendem Betreiber, aus core.run_quality_checks() --{" "}
          {allDuplicates.length} gesamt. Pro Paar entscheidest du, welcher Datensatz bestehen bleibt.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {duplicates.map((d, i) => {
          const a = byKey.get(d.key_a);
          const b = byKey.get(d.key_b);
          if (!a || !b) return null;
          return (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {a.name ?? a.operator ?? a.external_key} ({a.source}) ↔ {b.name ?? b.operator ?? b.external_key} ({b.source})
                </p>
                <p className="text-text-muted">
                  {[d.operator, a.city, `${d.distance_m}m Abstand`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link
                href={`/ladestationen/dubletten/${a.id}/${b.id}`}
                className="min-h-11 shrink-0 rounded-md bg-action px-3 py-2 text-sm font-medium leading-none hover:bg-action-hover"
              >
                Zusammenführen
              </Link>
            </div>
          );
        })}
        {allDuplicates.length === 0 && <p className="text-sm text-text-muted">Keine Dubletten gefunden.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/ladestationen/dubletten?page=${page - 1}`}>← Zurück</Link>}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && <Link href={`/ladestationen/dubletten?page=${page + 1}`}>Weiter →</Link>}
        </div>
      )}
    </div>
  );
}
