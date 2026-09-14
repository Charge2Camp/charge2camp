import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

const ISSUE_CHECKS = [
  { name: "coordinate_plausibility", label: "Unplausible Koordinaten", href: "/datenqualitaet/koordinaten" },
  { name: "duplicate_charge_points", label: "Mögliche Dubletten (Ladepunkte)", href: "/ladestationen/dubletten" },
  { name: "duplicate_campsites", label: "Mögliche Dubletten (Campingplätze)", href: "/campingplaetze/dubletten" },
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

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

/** Ausgelagert statt Date.now() direkt im Component-Body aufzurufen --
 * ESLint (react-hooks/purity) verlangt reine Render-Funktionen, auch fuer
 * async Server Components. */
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const [
    { count: campsiteCount },
    { count: chargePointCount },
    { count: pendingReportCount },
    usersResult,
    qualityResult,
    { count: savedRouteCount },
    { count: routesPlannedCount },
    { count: routesPlanned30dCount },
    { count: segmentExportCount },
    { count: fullExportCount },
    { data: lastUsageEvent },
    { data: lastOcmImportRows },
  ] = await Promise.all([
    supabase.schema("core").from("campsite").select("id", { count: "exact", head: true }),
    supabase.schema("core").from("charge_point").select("id", { count: "exact", head: true }),
    supabase.schema("enrich").from("trailer_report").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.schema("core").rpc("run_quality_checks"),
    supabase.from("saved_routes").select("id", { count: "exact", head: true }),
    supabase.schema("core").from("app_usage_event").select("id", { count: "exact", head: true }).eq("event_type", "route_planned"),
    supabase
      .schema("core")
      .from("app_usage_event")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "route_planned")
      .gte("created_at", daysAgoIso(30)),
    supabase.schema("core").from("app_usage_event").select("id", { count: "exact", head: true }).eq("event_type", "route_segment_export"),
    supabase.schema("core").from("app_usage_event").select("id", { count: "exact", head: true }).eq("event_type", "route_full_export"),
    supabase.schema("core").from("app_usage_event").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.schema("core").rpc("last_ocm_import"),
  ]);
  const lastOcmImport = lastOcmImportRows?.[0] as
    | { scope: string; status: string; record_count: number | null; finished_at: string | null; started_at: string }
    | undefined;

  const users = usersResult.data?.users ?? [];
  const userCount = users.length;
  const lastSignIns = users.map((u) => u.last_sign_in_at).filter((v): v is string => Boolean(v));
  const lastSignInAt = lastSignIns.length > 0 ? lastSignIns.sort().at(-1)! : null;
  // "Zuletzt genutzt": das juengere von "letztes protokolliertes
  // Nutzungsereignis" (Route geplant/exportiert) und "letzter Login" -- ein
  // Login allein bedeutet noch keine tatsaechliche Nutzung, ein Ereignis
  // ohne aktuellen Login (Session laenger gueltig) auch nicht unbedingt
  // repraesentativ, daher das juengere von beidem als bester verfuegbarer
  // Anhaltspunkt.
  const lastEventAt = lastUsageEvent?.created_at ?? null;
  const lastUsedAt = [lastEventAt, lastSignInAt].filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;

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

      <p className="text-xs text-text-muted">
        Letzter OCM-Import:{" "}
        {lastOcmImport ? (
          <>
            {formatDateTime(lastOcmImport.finished_at)} · {lastOcmImport.scope}
            {lastOcmImport.status !== "ok" && <span className="text-status-down"> ({lastOcmImport.status})</span>}
            {typeof lastOcmImport.record_count === "number" && ` · ${lastOcmImport.record_count} Ladepunkte`}
          </>
        ) : (
          "noch kein protokollierter Lauf"
        )}
        {" · "}läuft täglich per Vercel Cron, rotiert wochentagsweise durch die Kernländer.
      </p>

      <section>
        <h2 className="text-lg font-semibold">Nutzung</h2>
        <p className="mt-1 text-sm text-text-muted">
          Routen geplant/exportiert zählen erst ab Einführung dieser Statistik (29.09.2026) -- keine rückwirkenden
          Schätzwerte.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Routen geplant (gesamt)" value={routesPlannedCount ?? 0} />
          <KpiCard label="davon letzte 30 Tage" value={routesPlanned30dCount ?? 0} />
          <KpiCard label="Gespeicherte Routen" value={savedRouteCount ?? 0} href="/nutzer" />
          <KpiCard label="Zuletzt genutzt" value={formatDateTime(lastUsedAt)} />
          <KpiCard label="Ganze Routen exportiert" value={fullExportCount ?? 0} />
          <KpiCard label="Einzelne Etappen exportiert" value={segmentExportCount ?? 0} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Datenqualität</h2>
        <p className="mt-1 text-sm text-text-muted">
          Aus core.run_quality_checks() -- jede Zahl ist die Anzahl gefundener Auffälligkeiten (0 = unauffällig).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ISSUE_CHECKS.map((check) => {
            const count = countsByCheck.get(check.name) ?? 0;
            const content = (
              <>
                <span>{check.label}</span>
                <span className={`font-semibold ${count > 0 ? "text-status-busy" : "text-text-muted"}`}>{count}</span>
              </>
            );
            const className = `flex items-center justify-between rounded-md border p-3 text-sm ${
              count > 0 ? "border-status-busy/40 bg-status-busy/5" : "border-line"
            }`;
            return "href" in check ? (
              <Link key={check.name} href={check.href} className={`${className} hover:bg-line/20`}>
                {content}
              </Link>
            ) : (
              <div key={check.name} className={className}>
                {content}
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
