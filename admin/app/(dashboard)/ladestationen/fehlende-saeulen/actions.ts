"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Lehnt eine Nutzer-Meldung ab, ohne eine Ladestation anzulegen -- Guard
 * .eq("status","pending") verhindert doppeltes Bearbeiten (z.B. Doppelklick
 * oder zwei offene Tabs). */
export async function rejectMissingStationReport(reportId: number) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .schema("enrich")
    .from("missing_station_report")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", reportId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath("/ladestationen/fehlende-saeulen");
}
