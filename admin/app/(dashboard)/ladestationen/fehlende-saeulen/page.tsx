import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { MissingStationReport } from "@/lib/types";
import { rejectMissingStationReport } from "./actions";

export default async function MissingStationReportsPage() {
  const supabase = createServiceClient();

  const [{ data: reports, error }, usersResult] = await Promise.all([
    supabase
      .schema("enrich")
      .from("missing_station_report")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Meldungen konnten nicht geladen werden: {error.message}
        </p>
      </div>
    );
  }

  const pendingReports = (reports ?? []) as MissingStationReport[];
  const emailByUserId = new Map((usersResult.data?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Fehlende Säulen (Nutzer-Meldungen)</h1>
        <p className="mt-1 text-sm text-text-muted">
          Von Nutzern über &quot;Mein Profil&quot; gemeldete, bei uns fehlende Ladestationen -- {pendingReports.length}{" "}
          offen. Koordinaten werden, wenn möglich, automatisch aus dem geteilten Link erkannt (nur URL-Struktur, kein
          Zugriff auf Google-Maps-Inhalte); alles Weitere prüfst und ergänzt du beim Review.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {pendingReports.map((report) => (
          <div key={report.id} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{emailByUserId.get(report.user_id) ?? report.user_id}</p>
                <p className="text-text-muted">
                  {new Date(report.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <a
                href={report.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="min-h-11 whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm font-medium leading-none hover:bg-line/20"
              >
                In Google Maps öffnen
              </a>
            </div>
            <p className="text-text-muted">
              {report.extracted_latitude != null && report.extracted_longitude != null
                ? `Koordinaten erkannt: ${report.extracted_latitude}, ${report.extracted_longitude}`
                : "Keine Koordinaten automatisch erkannt -- bitte Link manuell öffnen."}
            </p>
            {report.notes && <p>{report.notes}</p>}
            <div className="flex gap-2">
              <Link
                href={`/ladestationen/fehlende-saeulen/${report.id}`}
                className="min-h-11 rounded-md bg-action px-3 py-2 text-sm font-medium leading-none hover:bg-action-hover"
              >
                Review starten
              </Link>
              <form action={rejectMissingStationReport.bind(null, report.id)}>
                <button
                  type="submit"
                  className="min-h-11 rounded-md border border-line px-3 py-2 text-sm font-medium leading-none hover:bg-line/20"
                >
                  Ablehnen
                </button>
              </form>
            </div>
          </div>
        ))}
        {pendingReports.length === 0 && <p className="text-sm text-text-muted">Keine offenen Meldungen.</p>}
      </div>
    </div>
  );
}
