import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

interface DuplicateRow {
  key_a: string;
  key_b: string;
  operator: string | null;
  distance_m: number;
}

export default async function ChargePointDuplicatesPage() {
  const supabase = createServiceClient();

  const { data: qualityRows } = await supabase.schema("core").rpc("run_quality_checks");
  const duplicates = ((qualityRows ?? []) as { check_name: string; data: unknown }[])
    .filter((r) => r.check_name === "duplicate_charge_points")
    .map((r) => r.data as DuplicateRow);

  const keys = Array.from(new Set(duplicates.flatMap((d) => [d.key_a, d.key_b])));
  const { data: stations } =
    keys.length > 0
      ? await supabase.schema("core").from("charge_point").select("id, external_key, name, operator, city, source").in("external_key", keys)
      : { data: [] as { id: string; external_key: string; name: string | null; operator: string | null; city: string | null; source: string }[] };
  const byKey = new Map((stations ?? []).map((s) => [s.external_key, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Mögliche Dubletten (Ladepunkte)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ladepunkte innerhalb von 25m mit übereinstimmendem Betreiber, aus core.run_quality_checks(). Pro Paar
          entscheidest du, welcher Datensatz bestehen bleibt.
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
        {duplicates.length === 0 && <p className="text-sm text-text-muted">Keine Dubletten gefunden.</p>}
      </div>
    </div>
  );
}
