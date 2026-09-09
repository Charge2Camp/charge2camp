import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

const ISSUE_CHECKS = [
  { name: "coordinate_plausibility", label: "Unplausible Koordinaten" },
  { name: "duplicate_charge_points", label: "Mögliche Dubletten (Ladepunkte)" },
  { name: "duplicate_campsites", label: "Mögliche Dubletten (Campingplätze)" },
  { name: "orphaned_enrichment", label: "Verwaiste Anreicherungsdaten" },
  { name: "stale_records", label: "Veraltete Datensätze (>14 Tage)" },
  { name: "disputed_verdicts", label: "Widersprüchliche Anhängertauglichkeit" },
  { name: "link_sanity", label: "Unplausible Campingplatz↔Ladepunkt-Verknüpfungen" },
  { name: "amenity_fill_rate", label: "Merkmale mit Füllgrad < 30 %" },
] as const;

function KpiCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const content = (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const [{ count: campsiteCount }, { count: chargePointCount }, { count: pendingReportCount }, usersResult, qualityResult] =
    await Promise.all([
      supabase.schema("core").from("campsite").select("id", { count: "exact", head: true }),
      supabase.schema("core").from("charge_point").select("id", { count: "exact", head: true }),
      supabase.schema("enrich").from("trailer_report").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.schema("core").rpc("run_quality_checks"),
    ]);

  const userCount = usersResult.data?.users.length ?? 0;
  const qualityRows = (qualityResult.data ?? []) as { check_name: string; data: unknown }[];
  const countsByCheck = new Map<string, number>();
  for (const row of qualityRows) {
    countsByCheck.set(row.check_name, (countsByCheck.get(row.check_name) ?? 0) + 1);
  }

  const coverageRows = qualityRows
    .filter((r) => r.check_name === "coverage_by_country")
    .map((r) => r.data as { country_code: string; total: number; coverage_percent: number | null });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Überblick über charge2camp-Daten und Nutzer.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Nutzer" value={userCount} href="/nutzer" />
        <KpiCard label="Campingplätze" value={campsiteCount ?? 0} href="/campingplaetze" />
        <KpiCard label="Ladestationen" value={chargePointCount ?? 0} href="/ladestationen" />
        <KpiCard label="Offene Meldungen" value={pendingReportCount ?? 0} href="/ladestationen/meldungen" />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Datenqualität</h2>
        <p className="mt-1 text-sm text-text-muted">
          Aus core.run_quality_checks() -- jede Zahl ist die Anzahl gefundener Auffälligkeiten (0 = unauffällig).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ISSUE_CHECKS.map((check) => {
            const count = countsByCheck.get(check.name) ?? 0;
            return (
              <div
                key={check.name}
                className={`flex items-center justify-between rounded-md border p-3 text-sm ${
                  count > 0 ? "border-status-busy/40 bg-status-busy/5" : "border-line"
                }`}
              >
                <span>{check.label}</span>
                <span className={`font-semibold ${count > 0 ? "text-status-busy" : "text-text-muted"}`}>{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {coverageRows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Anhängertauglichkeits-Abdeckung nach Land</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-text-muted">
                  <th className="py-2 pr-4">Land</th>
                  <th className="py-2 pr-4">Ladepunkte</th>
                  <th className="py-2 pr-4">Abdeckung</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((row) => (
                  <tr key={row.country_code} className="border-b border-line/50">
                    <td className="py-2 pr-4">{row.country_code}</td>
                    <td className="py-2 pr-4">{row.total}</td>
                    <td className="py-2 pr-4">{row.coverage_percent ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
