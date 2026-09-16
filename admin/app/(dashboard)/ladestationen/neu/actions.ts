"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createChargePointFromFormData } from "@/lib/charge-point-write";

/** Manuelles Nachpflegen einer Ladestation, die bei Open Charge Map (noch)
 * nicht gelistet ist (siehe Konversation: "Energie Suedbayern, Kufsteiner
 * Str. 116 Raubling" -- bei OCM nicht vorhanden). Duenner Wrapper um die
 * geteilte Schreiblogik in lib/charge-point-write.ts, die auch von der
 * Freigabe einer Nutzer-Meldung (ladestationen/fehlende-saeulen/[reportId])
 * genutzt wird. */
export async function addChargePoint(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const created = await createChargePointFromFormData(formData, admin, supabase);

  revalidatePath("/ladestationen");
  redirect(`/ladestationen/${created.id}`);
}
