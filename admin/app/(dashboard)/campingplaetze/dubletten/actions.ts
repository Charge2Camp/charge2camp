"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Siehe ladestationen/dubletten/actions.ts dismissChargePointDuplicate --
 * gleiches Prinzip fuer Campingplaetze. */
export async function dismissCampsiteDuplicate(keyA: string, keyB: string) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("core").rpc("dismiss_duplicate", {
    p_entity_type: "campsite",
    p_key_a: keyA,
    p_key_b: keyB,
    p_admin_id: admin.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/campingplaetze/dubletten");
  redirect("/campingplaetze/dubletten");
}
