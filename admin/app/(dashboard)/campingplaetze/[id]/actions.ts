"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function updateCampsite(campsiteId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .schema("core")
    .from("campsite")
    .update({
      name: formData.get("name") as string,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      country_code: (formData.get("country_code") as string) || null,
      website: (formData.get("website") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campsiteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}

/** EIN Formular fuer alle Merkmal-Checkboxen statt eines pro Merkmal --
 * `amenityKeys` sind die auf der Seite tatsaechlich angezeigten Checkboxen
 * (nur value_type="bool"), jede wird auf den aktuellen Haekchen-Zustand
 * gesetzt (auch "aus", falls vorher "an" war). */
export async function updateAmenities(campsiteId: string, amenityKeys: string[], formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const rows = amenityKeys.map((key) => ({
    campsite_id: campsiteId,
    amenity_key: key,
    value_bool: formData.get(key) === "1",
    source: "admin",
    confidence: 100,
  }));

  const { error } = await supabase.schema("core").from("campsite_amenity").upsert(rows, { onConflict: "campsite_id,amenity_key" });

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}

/** core.campsite_search (Quelle der Haupt-App-Liste/Suche/Karte) ist eine
 * MATERIALIZED VIEW -- anders als bei Ladestationen (einfache VIEW) wirkt
 * eine is_active-Aenderung an core.campsite deshalb NICHT sofort. Die RPC
 * core.refresh_campsite_search() (siehe Migration
 * 20260909020000_campsite_charge_point_active_flag.sql) stoesst den
 * Refresh CONCURRENTLY an -- unkritisch bei der Groesse dieser Tabelle. */
export async function setCampsiteActive(campsiteId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("core").from("campsite").update({ is_active: isActive }).eq("id", campsiteId);
  if (error) throw new Error(error.message);

  const { error: refreshError } = await supabase.schema("core").rpc("refresh_campsite_search");
  if (refreshError) throw new Error(refreshError.message);

  revalidatePath(`/campingplaetze/${campsiteId}`);
  revalidatePath("/campingplaetze");
}

export async function deleteCampsiteReview(reviewId: string, campsiteId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("campsite_reviews").delete().eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}
