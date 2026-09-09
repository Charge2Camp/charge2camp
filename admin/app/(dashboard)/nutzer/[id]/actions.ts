"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** ~100 Jahre -- Supabase kennt kein "fuer immer", ban_duration ist ein
 * Zeitraum ab jetzt. "none" hebt eine Sperre wieder auf. */
const BAN_DURATION = "876000h";

export async function setBanned(userId: string, banned: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? BAN_DURATION : "none",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/nutzer/${userId}`);
  revalidatePath("/nutzer");
}

export async function setIsAdmin(userId: string, isAdmin: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/nutzer/${userId}`);
  revalidatePath("/nutzer");
}

/** Loescht das Konto vollstaendig (auth.users, cascadiert per FK auf
 * profiles/vehicles/caravans/favorites/... -- siehe "on delete cascade" in
 * supabase/migrations/20260904210000_init_schema.sql). Unwiderruflich. */
export async function deleteAccount(userId: string) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  redirect("/nutzer");
}
