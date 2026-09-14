"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Markiert ein Ladepunkt-Paar als "keine Dublette, bewusst getrennt
 * lassen" -- core.run_quality_checks() ist eine reine Live-Abfrage ohne
 * eigenes Gedaechtnis, ohne diese Ablehnungstabelle wuerde dasselbe Paar
 * bei jedem Aufruf wieder auftauchen. */
export async function dismissChargePointDuplicate(keyA: string, keyB: string) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("core").rpc("dismiss_duplicate", {
    p_entity_type: "charge_point",
    p_key_a: keyA,
    p_key_b: keyB,
    p_admin_id: admin.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/ladestationen/dubletten");
  redirect("/ladestationen/dubletten");
}
