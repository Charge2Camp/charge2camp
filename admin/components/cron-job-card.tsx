/** Statuskarte fuer einen pg_cron-Job im Admin-Dashboard (Daten aus
 * core.cron_job_health, Migration 20261026230000). Symbol + Text zeigen den Zustand,
 * die Farbe unterstuetzt ihn nur (Brand-Guide: Farbe steht nie allein). */

export type CronHealthRow = {
  job_exists: boolean;
  job_active: boolean;
  last_finished_status: string | null;
  last_success_at: string | null;
  minutes_since_last_success: number | null;
  failed_in_last_10: number;
  healthy: boolean;
  reason: string;
};

/** "vor 12 Min." / "vor 3 Std." / "vor 10 Tagen" aus Minuten. */
export function formatAgeMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "noch nie";
  if (minutes < 60) return `vor ${Math.round(minutes)} Min.`;
  if (minutes < 60 * 48) return `vor ${Math.round(minutes / 60)} Std.`;
  return `vor ${Math.round(minutes / 1440)} Tagen`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function CronJobCard({
  label,
  rhythm,
  health,
}: {
  label: string;
  rhythm: string;
  /** `undefined`, wenn der Abruf fehlgeschlagen ist (der Fehler steht dann im Fehlerkasten des Dashboards). */
  health: CronHealthRow | undefined;
}) {
  const unknown = !health;
  const ok = Boolean(health?.healthy);
  return (
    <div className={`rounded-lg border p-4 ${ok ? "border-line bg-card" : "border-status-down/40 bg-status-down/5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-text-muted">{rhythm}</p>
        </div>
        <p className={`shrink-0 text-sm font-semibold ${ok ? "text-text-muted" : "text-status-down"}`}>
          {unknown ? "? Unbekannt" : ok ? "✓ In Ordnung" : "⚠ Problem"}
        </p>
      </div>
      <p className="mt-2 text-sm">
        Letzter Erfolg:{" "}
        <span className="font-medium">{health ? formatAgeMinutes(health.minutes_since_last_success) : "–"}</span>
        {health?.last_success_at && <span className="text-text-muted"> ({formatDateTime(health.last_success_at)})</span>}
      </p>
      {health && !ok && <p className="mt-1 text-sm text-status-down">{health.reason}</p>}
      {health && health.failed_in_last_10 > 0 && (
        <p className="mt-1 text-xs text-text-muted">{health.failed_in_last_10} von den letzten 10 Läufen fehlgeschlagen</p>
      )}
    </div>
  );
}
