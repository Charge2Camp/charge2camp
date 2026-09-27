"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyMissingStationReportDecision } from "@/lib/notify-missing-station-report";

/** Lehnt eine Nutzer-Meldung ab, ohne eine Ladestation anzulegen -- Guard
 * .eq("status","pending") verhindert doppeltes Bearbeiten (z.B. Doppelklick
 * oder zwei offene Tabs). */
export async function rejectMissingStationReport(reportId: number) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { data: updated, error } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", reportId)
    .eq("status", "pending")
    .select("user_id, google_maps_url")
    .maybeSingle();

  if (error) throw new Error(error.message);
  revalidatePath("/ladestationen/fehlende-saeulen");

  // UX-05.7: E-Mail-Benachrichtigung ist bewusst fehlertolerant (s. JSDoc in
  // notify-missing-station-report.ts) -- ein Fehler hier darf die bereits
  // erfolgte Ablehnung nicht rueckgaengig machen.
  if (updated) {
    try {
      const { data: user } = await supabase.auth.admin.getUserById(updated.user_id);
      if (user.user?.email) {
        await notifyMissingStationReportDecision({
          email: user.user.email,
          googleMapsUrl: updated.google_maps_url,
          status: "rejected",
        });
      }
    } catch (notifyError) {
      console.error("Benachrichtigung ueber abgelehnte Meldung fehlgeschlagen:", notifyError);
    }
  }
}
