import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { dismissCampsiteDuplicate } from "./actions";

interface DuplicateRow {
  key_a: string;
  key_b: string;
  name: string | null;
  distance_m: number;
  name_similarity: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const PAGE_SIZE = 50;

export default async function CampsiteDuplicatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
  const rawDuplicates = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "duplicate_campsites")
    .map((r) => r.data as DuplicateRow);

  const { data: dismissedRows, error: dismissedError } = await supabase
    .schema("core")
    .from("duplicate_dismissal")
    .select("key_a, key_b")
    .eq("entity_type", "campsite");
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
  const allDuplicates = rawDuplicates.filter((d) => {
    const lo = d.key_a < d.key_b ? d.key_a : d.key_b;
    const hi = d.key_a < d.key_b ? d.key_b : d.key_a;
    return !dismissedSet.has(`${lo}|${hi}`);
  });

  const totalPages = Math.max(1, Math.ceil(allDuplicates.length / PAGE_SIZE));
  const duplicates = allDuplicates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Siehe ladestationen/dubletten/page.tsx: nur die aktuelle Seite
  // aufloesen, sonst sprengt ein .in() mit allen external_keys die
  // maximale URI-Laenge bei vielen Treffern.
  const keys = Array.from(new Set(duplicates.flatMap((d) => [d.key_a, d.key_b])));
  const campsites: { id: string; external_key: string; name: string; city: string | null; source: string }[] = [];
  for (const batch of chunk(keys, 150)) {
    const { data, error } = await supabase.schema("core").from("campsite").select("id, external_key, name, city, source").in("external_key", batch);
    if (error) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/" className="text-sm text-text-muted hover:underline">
            ← Dashboard
          </Link>
          <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
            Campingplätze konnten nicht geladen werden: {error.message}
          </p>
        </div>
      );
    }
    campsites.push(...(data ?? []));
  }
  const byKey = new Map(campsites.map((s) => [s.external_key, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mögliche Dubletten (Campingplätze)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Campingplätze innerhalb von 300m mit ähnlichem Namen, aus core.run_quality_checks() -- {allDuplicates.length}{" "}
          gesamt. Pro Paar entscheidest du, welcher Datensatz bestehen bleibt.
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
                  {a.name} ({a.source}) ↔ {b.name} ({b.source})
                </p>
                <p className="text-text-muted">
                  {[a.city, `${d.distance_m}m Abstand`, `${Math.round(d.name_similarity * 100)}% Namensähnlichkeit`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/campingplaetze/dubletten/${a.id}/${b.id}`}
                  className="min-h-11 rounded-md bg-action px-3 py-2 text-sm font-medium leading-none hover:bg-action-hover"
                >
                  Zusammenführen
                </Link>
                <form action={dismissCampsiteDuplicate.bind(null, d.key_a, d.key_b)}>
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
        {allDuplicates.length === 0 && <p className="text-sm text-text-muted">Keine Dubletten gefunden.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/campingplaetze/dubletten?page=${page - 1}`}>← Zurück</Link>}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && <Link href={`/campingplaetze/dubletten?page=${page + 1}`}>Weiter →</Link>}
        </div>
      )}
    </div>
  );
}
