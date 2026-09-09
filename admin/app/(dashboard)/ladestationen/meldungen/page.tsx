import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { TrailerReport } from "@/lib/types";
import { moderateReport } from "./actions";

export default async function TrailerReportsPage() {
  const supabase = createServiceClient();

  const { data: reports } = await supabase
    .schema("enrich")
    .from("trailer_report")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const pendingReports = (reports ?? []) as TrailerReport[];

  const keys = Array.from(new Set(pendingReports.map((r) => r.charge_point_key)));
  const { data: stations } =
    keys.length > 0
      ? await supabase.schema("core").from("charge_point").select("id, external_key, name, operator").in("external_key", keys)
      : { data: [] as { id: string; external_key: string; name: string | null; operator: string | null }[] };
  const stationByKey = new Map((stations ?? []).map((s) => [s.external_key, s]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Meldungen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Von Nutzern eingereichte Anhängertauglichkeits-Meldungen, noch nicht freigegeben oder abgelehnt.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {pendingReports.map((report) => {
          const station = stationByKey.get(report.charge_point_key);
          return (
            <div key={report.id} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {station ? (
                    <Link href={`/ladestationen/${station.id}`} className="hover:underline">
                      {station.name ?? station.operator ?? station.external_key}
                    </Link>
                  ) : (
                    report.charge_point_key
                  )}
                </p>
                <p className="text-text-muted">
                  Meldung: {report.verdict}
                  {report.drive_through !== null && `, Drive-Through: ${report.drive_through ? "ja" : "nein"}`}
                </p>
                {report.notes && <p className="text-text-muted">{report.notes}</p>}
              </div>
              <div className="flex gap-2">
                <form action={moderateReport.bind(null, report.id, "approve")}>
                  <button type="submit" className="min-h-11 rounded-md bg-route px-3 text-sm font-medium text-white hover:opacity-90">
                    Annehmen
                  </button>
                </form>
                <form action={moderateReport.bind(null, report.id, "reject")}>
                  <button type="submit" className="min-h-11 rounded-md border border-status-down px-3 text-sm font-medium text-status-down hover:bg-status-down/10">
                    Ablehnen
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {pendingReports.length === 0 && <p className="text-sm text-text-muted">Keine offenen Meldungen.</p>}
      </div>
    </div>
  );
}
