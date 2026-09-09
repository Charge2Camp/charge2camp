"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Ruft dieselbe RPC wie die Haupt-App (POST .../trailer/moderate) auf --
 * eigenstaendig implementiert statt die Haupt-App-API aufzurufen, damit
 * diese App unabhaengig vom Deploy-Status der Haupt-App funktioniert. */
export async function moderateReport(reportId: number, decision: "approve" | "reject") {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("enrich").rpc("moderate_trailer_report", {
    p_report_id: reportId,
    p_decision: decision,
    p_moderator_id: admin.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/ladestationen/meldungen");
}
