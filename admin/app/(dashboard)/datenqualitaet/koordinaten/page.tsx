import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

interface CoordinateIssue {
  entity_type: "charge_point" | "campsite";
  external_key: string;
  country_code: string | null;
  lat: number;
  lon: number;
}

export default async function CoordinateQualityPage() {
  const supabase = createServiceClient();

  const { data: qualityRows } = await supabase.schema("core").rpc("run_quality_checks");
  const issues = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "coordinate_plausibility")
    .map((r) => r.data as CoordinateIssue);

  const cpKeys = issues.filter((i) => i.entity_type === "charge_point").map((i) => i.external_key);
  const csKeys = issues.filter((i) => i.entity_type === "campsite").map((i) => i.external_key);

  const [{ data: chargePoints }, { data: campsites }] = await Promise.all([
    cpKeys.length > 0
      ? supabase.schema("core").from("charge_point").select("id, external_key, name, operator").in("external_key", cpKeys)
      : Promise.resolve({ data: [] as { id: string; external_key: string; name: string | null; operator: string | null }[] }),
    csKeys.length > 0
      ? supabase.schema("core").from("campsite").select("id, external_key, name").in("external_key", csKeys)
      : Promise.resolve({ data: [] as { id: string; external_key: string; name: string }[] }),
  ]);
  const cpById = new Map((chargePoints ?? []).map((s) => [s.external_key, s]));
  const csById = new Map((campsites ?? []).map((s) => [s.external_key, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Unplausible Koordinaten</h1>
        <p className="mt-1 text-sm text-text-muted">
          (0,0), oder außerhalb der Europa-Bounding-Box für den angegebenen Ländercode. Aus
          core.run_quality_checks(). Klick auf einen Eintrag, um die Koordinaten in den Stammdaten zu korrigieren.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {issues.map((issue, i) => {
          const entity = issue.entity_type === "charge_point" ? cpById.get(issue.external_key) : csById.get(issue.external_key);
          if (!entity) return null;
          const href = issue.entity_type === "charge_point" ? `/ladestationen/${entity.id}` : `/campingplaetze/${entity.id}`;
          const label =
            "name" in entity ? entity.name ?? issue.external_key : issue.external_key;
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
        {issues.length === 0 && <p className="text-sm text-text-muted">Keine Auffälligkeiten gefunden.</p>}
      </div>
    </div>
  );
}
