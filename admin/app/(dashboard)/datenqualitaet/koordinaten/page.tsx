import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

interface CoordinateIssue {
  entity_type: "charge_point" | "campsite";
  external_key: string;
  country_code: string | null;
  lat: number;
  lon: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const PAGE_SIZE = 50;

export default async function CoordinateQualityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
  const allIssues = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "coordinate_plausibility")
    .map((r) => r.data as CoordinateIssue);

  const totalPages = Math.max(1, Math.ceil(allIssues.length / PAGE_SIZE));
  const issues = allIssues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Siehe ladestationen/dubletten/page.tsx: nur die aktuelle Seite
  // aufloesen und in kleinen Batches, sonst sprengt ein .in() mit vielen
  // external_keys die maximale URI-Laenge.
  const cpKeys = issues.filter((i) => i.entity_type === "charge_point").map((i) => i.external_key);
  const csKeys = issues.filter((i) => i.entity_type === "campsite").map((i) => i.external_key);

  const chargePoints: { id: string; external_key: string; name: string | null; operator: string | null }[] = [];
  for (const batch of chunk(cpKeys, 150)) {
    const { data, error } = await supabase.schema("core").from("charge_point").select("id, external_key, name, operator").in("external_key", batch);
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
    chargePoints.push(...(data ?? []));
  }

  const campsites: { id: string; external_key: string; name: string }[] = [];
  for (const batch of chunk(csKeys, 150)) {
    const { data, error } = await supabase.schema("core").from("campsite").select("id, external_key, name").in("external_key", batch);
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

  const cpById = new Map(chargePoints.map((s) => [s.external_key, s]));
  const csById = new Map(campsites.map((s) => [s.external_key, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Unplausible Koordinaten</h1>
        <p className="mt-1 text-sm text-text-muted">
          (0,0), oder außerhalb der Europa-Bounding-Box für den angegebenen Ländercode. Aus
          core.run_quality_checks() -- {allIssues.length} gesamt. Klick auf einen Eintrag, um die Koordinaten in den
          Stammdaten zu korrigieren.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {issues.map((issue, i) => {
          const entity = issue.entity_type === "charge_point" ? cpById.get(issue.external_key) : csById.get(issue.external_key);
          if (!entity) return null;
          const href = issue.entity_type === "charge_point" ? `/ladestationen/${entity.id}` : `/campingplaetze/${entity.id}`;
          const label = "name" in entity ? entity.name ?? issue.external_key : issue.external_key;
          return (
            <Link key={i} href={href} className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20">
              <div>
                <p className="font-medium">
                  {label} ({issue.entity_type === "charge_point" ? "Ladepunkt" : "Campingplatz"})
                </p>
                <p className="text-text-muted">
                  {issue.country_code ?? "?"} · lat {issue.lat}, lon {issue.lon}
                </p>
              </div>
            </Link>
          );
        })}
        {allIssues.length === 0 && <p className="text-sm text-text-muted">Keine Auffälligkeiten gefunden.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/datenqualitaet/koordinaten?page=${page - 1}`}>← Zurück</Link>}
          <span className="text-text-muted">
            Seite {page} von {totalPages}
          </span>
          {page < totalPages && <Link href={`/datenqualitaet/koordinaten?page=${page + 1}`}>Weiter →</Link>}
        </div>
      )}
    </div>
  );
}
