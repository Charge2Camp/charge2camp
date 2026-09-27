"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createChargePointFromFormData } from "@/lib/charge-point-write";
import { notifyMissingStationReportDecision } from "@/lib/notify-missing-station-report";

/** Legt die Ladestation ueber denselben Schreibpfad wie "Ladestation
 * manuell anlegen" an (siehe lib/charge-point-write.ts) und schliesst die
 * Meldung im selben Zug ab. Kein Transaktions-Wrapping zwischen Stations-
 * Insert und Report-Update (gleiches, bereits bestehendes Muster wie in
 * addChargePoint selbst -- mehrere sequenzielle Inserts ohne RPC) -- im
 * Fehlerfall zwischen beiden Schritten bliebe ein Ladepunkt ohne
 * Report-Verknuepfung stehen, das ist ein akzeptiertes, bereits bestehendes
 * Risiko, kein neues.
 *
 * Doppelter Guard gegen Doppel-Klick/zwei offene Tabs: einmal vor dem
 * Anlegen (Status-Check), einmal im WHERE der Report-Aktualisierung. */
export async function approveMissingStationReport(reportId: number, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { data: report } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .select("status, user_id, google_maps_url")
    .eq("id", reportId)
    .maybeSingle();
  if (!report || report.status !== "pending") {
    throw new Error("Diese Meldung wurde bereits bearbeitet.");
  }

  const created = await createChargePointFromFormData(formData, admin, supabase);

  const { error } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .update({
      status: "approved",
      created_charge_point_id: created.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq("id", reportId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/ladestationen");
  revalidatePath("/ladestationen/fehlende-saeulen");

  // UX-05.7: bewusst fehlertolerant (s. JSDoc in notify-missing-station-
  // report.ts) -- vor dem redirect(), da Code danach nie ausgefuehrt wird.
  try {
    const { data: user } = await supabase.auth.admin.getUserById(report.user_id);
    if (user.user?.email) {
      await notifyMissingStationReportDecision({
        email: user.user.email,
        googleMapsUrl: report.google_maps_url,
        status: "approved",
      });
    }
  } catch (notifyError) {
    console.error("Benachrichtigung ueber angenommene Meldung fehlgeschlagen:", notifyError);
  }

  redirect(`/ladestationen/${created.id}`);
}
