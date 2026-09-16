"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createChargePointFromFormData } from "@/lib/charge-point-write";

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
    .select("status")
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
  redirect(`/ladestationen/${created.id}`);
}
