"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function mergeCampsites(formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const survivorId = formData.get("survivor_id") as string;
  const aId = formData.get("a_id") as string;
  const bId = formData.get("b_id") as string;
  if (!survivorId || (survivorId !== aId && survivorId !== bId)) throw new Error("Ungültige Auswahl.");
  const otherId = survivorId === aId ? bId : aId;

  const field = (name: string) => (formData.get(`field_${name}`) as string) || null;

  const { error } = await supabase.schema("core").rpc("merge_campsites", {
    p_keep_id: survivorId,
    p_remove_id: otherId,
    p_name: field("name") ?? "",
    p_address: field("address"),
    p_postcode: field("postcode"),
    p_city: field("city"),
    p_country_code: field("country_code"),
    p_website: field("website"),
    p_phone: field("phone"),
    p_email: field("email"),
    p_capacity: formData.get("field_capacity") ? Number(formData.get("field_capacity")) : null,
  });

  if (error) throw new Error(error.message);

  const { error: refreshError } = await supabase.schema("core").rpc("refresh_campsite_search");
  if (refreshError) throw new Error(refreshError.message);

  revalidatePath("/campingplaetze");
  revalidatePath("/campingplaetze/dubletten");
  redirect(`/campingplaetze/${survivorId}`);
}
