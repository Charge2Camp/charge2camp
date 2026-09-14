"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** "keepId"/"removeId" im Formular sind nur die vorausgewaehlten IDs aus
 * der Liste -- welcher Datensatz TATSAECHLICH bestehen bleibt, entscheidet
 * das "survivor"-Radio auf der Seite selbst (Admin kann jede der beiden
 * Stationen als Ziel waehlen, Felder werden trotzdem frei aus beiden
 * gemischt). */
export async function mergeChargePoints(formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const survivorId = formData.get("survivor_id") as string;
  const aId = formData.get("a_id") as string;
  const bId = formData.get("b_id") as string;
  if (!survivorId || (survivorId !== aId && survivorId !== bId)) throw new Error("Ungültige Auswahl.");
  const otherId = survivorId === aId ? bId : aId;

  const field = (name: string) => (formData.get(`field_${name}`) as string) || null;

  const { error } = await supabase.schema("core").rpc("merge_charge_points", {
    p_keep_id: survivorId,
    p_remove_id: otherId,
    p_name: field("name"),
    p_operator: field("operator"),
    p_network: field("network"),
    p_address: field("address"),
    p_postcode: field("postcode"),
    p_city: field("city"),
    p_country_code: field("country_code"),
    p_access_type: field("access_type"),
    p_is_operational: formData.get("field_is_operational") === "1",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/ladestationen");
  revalidatePath("/ladestationen/dubletten");
  redirect(`/ladestationen/${survivorId}`);
}
