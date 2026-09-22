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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
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

/** Gleiche Wochenstart-Definition wie datenqualitaet/woche/page.tsx (letzter
 * Montag 00:00) -- hier nur fuer die KPI-Kachel, die Detailseite macht die
 * eigentliche Aufschluesselung. */
function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getTime() - diffToMonday * DAY_MS);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

type LastImportRow = { scope: string; status: string; record_count: number | null; finished_at: string | null; started_at: string };

// Alle drei nationalen CSV-Quellen (Admin-Upload via GitHub Actions, siehe
// massenupload/) -- vorher zeigte der Dashboard nur BNetzA an, IRVE
// (Frankreich) und RIPREE (Spanien) liefen zwar bereits regelmaessig ueber
// denselben Upload-Weg, waren aber nirgends im Ueberblick sichtbar (Audit-
// Befund 2026-09-22: "Es fehlt die Info, wann zuletzt die FR Liste
// hochgeladen wurde"). source-Werte muessen core.source_registry.source_id
// entsprechen (core.last_import() ist der generalisierte Nachfolger von
// core.last_ocm_import(), siehe 20261015000000_last_bnetza_import_info.sql).
const NATIONAL_SOURCES = [
  { source: "bundesnetzagentur", label: "BNetzA (Deutschland)" },
  { source: "irve", label: "IRVE (Frankreich)" },
  { source: "ripree", label: "RIPREE (Spanien)" },
] as const;

export default async function DashboardPage() {
  const supabase = createServiceClient();

  const [
    [
      { count: campsiteCount, error: campsiteError },
      { count: chargePointCount, error: chargePointError },
      { count: pendingReportCount, error: pendingReportError },
      usersResult,
      qualityResult,
      { count: savedRouteCount, error: savedRouteError },
      { count: routesPlannedCount, error: routesPlannedError },
      { count: routesPlanned30dCount },
      { count: segmentExportCount },
      { count: fullExportCount },
      { data: lastOcmImportRows, error: lastOcmImportError },
      { count: newChargePointCount },
      { count: newCampsiteCount },
      { data: activeUserRows7d },
      { data: activeUserRows30d },
      { count: pendingMissingStationCount },
    ],
    nationalImportResults,
  ] = await Promise.all([
    Promise.all([
      supabase.schema("core").from("campsite").select("id", { count: "exact", head: true }),
      supabase.schema("core").from("charge_point").select("id", { count: "exact", head: true }),
      supabase.schema("enrich").from("trailer_report").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      // core.quality_check_summary() statt run_quality_checks(): liefert
      // pro Check nur die Anzahl (ausser coverage_by_country, siehe dort)
      // statt aller 28k+ Einzelzeilen -- diese Seite zeigt nur Kacheln mit
      // Zahlen, keine Einzeldaten (Audit-Befund 2026-09-22).
      supabase.schema("core").rpc("quality_check_summary"),
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
      supabase.schema("core").rpc("last_ocm_import"),
      supabase.schema("core").from("charge_point").select("id", { count: "exact", head: true }).gte("created_at", startOfWeekIso()),
      supabase.schema("core").from("campsite").select("id", { count: "exact", head: true }).gte("created_at", startOfWeekIso()),
      // "Aktive Nutzer" = eindeutige user_id mit mind. einem app_usage_event
      // im Zeitraum -- einfache Engagement-Kennzahl aus dem ohnehin schon
      // protokollierten Log, kein zusaetzliches Tracking noetig. Distinct
      // count geht in Supabase-JS nicht direkt, deshalb user_id-Spalte laden
      // und in JS dedupliezieren (unproblematisch bei der aktuellen Groesse).
      supabase.schema("core").from("app_usage_event").select("user_id").gte("created_at", daysAgoIso(7)),
      supabase.schema("core").from("app_usage_event").select("user_id").gte("created_at", daysAgoIso(30)),
      supabase.schema("enrich").from("missing_station_report").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]),
    Promise.all(NATIONAL_SOURCES.map((s) => supabase.schema("core").rpc("last_import", { p_source: s.source }))),
  ]);

  const lastOcmImport = lastOcmImportRows?.[0] as LastImportRow | undefined;
  // Ein Quellenlauf kann in einer Umgebung noch NIE gelaufen sein (z. B.
  // RIPREE erst kuerzlich angebunden) -- bleibt dann bewusst undefined statt
  // eines Platzhalter-Laufs.
  const nationalImports = NATIONAL_SOURCES.map((s, i) => ({
    ...s,
    lastImport: (nationalImportResults[i].data?.[0] as LastImportRow | undefined) ?? undefined,
    error: nationalImportResults[i].error,
  }));

  // Fehler aus den Ueberblick-Abfragen sichtbar machen statt sie als
  // irrefuehrende "0" zu zeigen (Audit-Befund 2026-09-22: "im Dashboard
  // werden im Ueberblick keine oder falsche Zahlen gezeigt" -- keine der
  // Abfragen oben pruefte bisher `.error`, ein fehlgeschlagener Request
  // sah exakt so aus wie "0 Datensaetze").
  const queryErrorEntries: [string, { message: string } | null | undefined][] = [
    ["Campingplätze", campsiteError],
    ["Ladestationen", chargePointError],
    ["Offene Meldungen", pendingReportError],
    ["Nutzer", usersResult.error],
    ["Datenqualität", qualityResult.error],
    ["Gespeicherte Routen", savedRouteError],
    ["Routen geplant", routesPlannedError],
    ["Letzter OCM-Import", lastOcmImportError],
    ...nationalImports.map((n): [string, { message: string } | null | undefined] => [`Letzter ${n.label}-Import`, n.error]),
  ];
  const queryErrors = queryErrorEntries.filter(
    (entry): entry is [string, { message: string }] => Boolean(entry[1])
  );

  const userCount = usersResult.data?.users.length ?? 0;
  const weekStart = startOfWeekIso();
  const newUserCount = (usersResult.data?.users ?? []).filter((u) => u.created_at >= weekStart).length;
  const newThisWeekCount = (newChargePointCount ?? 0) + (newCampsiteCount ?? 0) + newUserCount;
  const activeUsers7d = new Set((activeUserRows7d ?? []).map((e) => e.user_id).filter(Boolean)).size;
  const activeUsers30d = new Set((activeUserRows30d ?? []).map((e) => e.user_id).filter(Boolean)).size;

  const qualitySummaryRows = (qualityResult.data ?? []) as { check_name: string; cnt: number; data: unknown }[];
  const countsByCheck = new Map<string, number>();
  for (const row of qualitySummaryRows) {
    if (row.check_name === "coverage_by_country") continue;
    countsByCheck.set(row.check_name, row.cnt);
  }
  const openIssueCount = ISSUE_CHECKS.reduce((sum, c) => sum + (countsByCheck.get(c.name) ?? 0), 0);

  const coverageRows = qualitySummaryRows
    .filter((r) => r.check_name === "coverage_by_country")
    .map((r) => r.data as { country_code: string; total: number; coverage_percent: number | null });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Überblick über charge2camp-Daten und Nutzer.</p>
      </div>

      {queryErrors.length > 0 && (
        <div className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          <p className="font-medium">
            {queryErrors.length === 1 ? "Eine Abfrage" : `${queryErrors.length} Abfragen`} für dieses Dashboard{" "}
            {queryErrors.length === 1 ? "ist" : "sind"} fehlgeschlagen -- betroffene Zahlen unten zeigen 0 statt des
            echten Werts, bis der Fehler behoben ist:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {queryErrors.map(([label, err]) => (
              <li key={label}>
                {label}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Überblick">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Nutzer" value={userCount} href="/nutzer" />
          <KpiCard label="Campingplätze" value={campsiteCount ?? 0} href="/campingplaetze" />
          <KpiCard label="Ladestationen" value={chargePointCount ?? 0} href="/ladestationen" />
          <KpiCard label="Offene Meldungen" value={pendingReportCount ?? 0} href="/ladestationen/meldungen" />
          <KpiCard label="Fehlende Säulen (offen)" value={pendingMissingStationCount ?? 0} href="/ladestationen/fehlende-saeulen" />
          <KpiCard label="Neu diese Woche" value={newThisWeekCount} href="/datenqualitaet/woche" />
        </div>
      </Section>

      <Section
        title="Ladenetz"
        description="OCM läuft täglich per Vercel Cron. Nationale Register (BNetzA/IRVE/RIPREE) werden manuell über den Massenupload aktualisiert, siehe unten."
      >
        <p className="text-sm">
          Letzter OCM-Import:{" "}
          {lastOcmImport ? (
            <>
              <span className="font-medium">{formatDateTime(lastOcmImport.finished_at)}</span> · {lastOcmImport.scope}
              {lastOcmImport.status !== "ok" && <span className="text-status-down"> ({lastOcmImport.status})</span>}
              {typeof lastOcmImport.record_count === "number" && ` · ${lastOcmImport.record_count} Ladepunkte`}
            </>
          ) : (
            "noch kein protokollierter Lauf"
          )}
        </p>
        {nationalImports.map((n) => (
          <p key={n.source} className="mt-2 text-sm">
            Letzter {n.label}-Import:{" "}
            {n.lastImport ? (
              <>
                <span className="font-medium">{formatDateTime(n.lastImport.finished_at)}</span> · {n.lastImport.scope}
                {n.lastImport.status !== "ok" && <span className="text-status-down"> ({n.lastImport.status})</span>}
                {typeof n.lastImport.record_count === "number" && ` · ${n.lastImport.record_count} Ladepunkte`}
              </>
            ) : (
              "noch nie importiert"
            )}
          </p>
        ))}
        <p className="mt-3 text-sm">
          <Link href="/ladestationen/massenupload" className="text-action hover:underline">
            Neue Datei hochladen (BNetzA/IRVE/RIPREE) →
          </Link>
        </p>
      </Section>

      <Section
        title="Nutzung & Routenplanung"
        description="Routen geplant/exportiert zählen erst ab Einführung dieser Statistik (29.09.2026) -- keine rückwirkenden Schätzwerte. Login-Zeitpunkt und Routenanzahl je Nutzer stehen auf der jeweiligen Nutzerseite."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Routen geplant (gesamt)" value={routesPlannedCount ?? 0} />
          <KpiCard label="davon letzte 30 Tage" value={routesPlanned30dCount ?? 0} />
          <KpiCard label="Gespeicherte Routen" value={savedRouteCount ?? 0} href="/nutzer" />
          <KpiCard label="Ganze Routen exportiert" value={fullExportCount ?? 0} />
          <KpiCard label="Einzelne Etappen exportiert" value={segmentExportCount ?? 0} />
          <KpiCard label="Aktive Nutzer (7 Tage)" value={activeUsers7d} href="/nutzer" />
          <KpiCard label="Aktive Nutzer (30 Tage)" value={activeUsers30d} href="/nutzer" />
        </div>
      </Section>

      <Section
        title="Datenqualität"
        description={`Aus core.run_quality_checks() -- ${openIssueCount} Auffälligkeiten insgesamt (0 = unauffällig).`}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      </Section>

      {coverageRows.length > 0 && (
        <Section title="Anhängertauglichkeits-Abdeckung nach Land">
          <div className="overflow-x-auto">
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
        </Section>
      )}
    </div>
  );
}
