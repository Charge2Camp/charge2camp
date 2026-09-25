import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MissingStationReportForm } from "@/components/profile/missing-station-report-form";

const STATUS_LABELS: Record<string, string> = {
  pending: "Wird geprüft",
  approved: "Eingepflegt",
  rejected: "Abgelehnt",
};

export default async function MissingStationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: reports } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .select("id, google_maps_url, notes, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="text-lg font-semibold">Fehlende Ladestation melden</h2>
      <p className="mt-1 text-sm text-text-muted">
        Fehlt eine anhängertaugliche Ladestation auf der Karte? Teile uns den Standort per Google-Maps-Link -- wir
        lesen daraus automatisch die Koordinaten aus, alles Weitere (Name, Betreiber, Anschlüsse, Anhängertauglichkeit)
        trägt ein Admin nach der Prüfung von Hand nach.
      </p>

      <div className="mt-6">
        <MissingStationReportForm />
      </div>

      {reports && reports.length > 0 && (
        <section className="mt-10">
          <h3 className="font-semibold">Meine Meldungen</h3>
          {/* UX-05.7: kein Push/E-Mail bei Statusaenderung -- der Status
              hier aktualisiert sich nur, wenn diese Seite erneut besucht
              wird. Ehrlich benannt statt stillschweigend so zu tun, als
              kaeme automatisch eine Rueckmeldung. */}
          <p className="mt-1 text-xs text-text-muted">
            Der Status aktualisiert sich, sobald du diese Seite erneut besuchst -- es gibt noch keine
            Benachrichtigung per E-Mail oder Push.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <a href={r.google_maps_url} target="_blank" rel="noreferrer" className="truncate underline">
                    {r.google_maps_url}
                  </a>
                  <span className="whitespace-nowrap text-text-muted">{STATUS_LABELS[r.status] ?? r.status}</span>
                </div>
                {r.notes && <p className="mt-1 text-text-muted">{r.notes}</p>}
                <p className="mt-1 text-xs text-text-muted">
                  {new Date(r.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
