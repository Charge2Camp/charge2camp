"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { ManeuveringSpace, TrailerVerdict } from "@/lib/types";

export async function updateChargePoint(chargePointId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .schema("core")
    .from("charge_point")
    .update({
      name: (formData.get("name") as string) || null,
      operator: (formData.get("operator") as string) || null,
      address: (formData.get("address") as string) || null,
      city: (formData.get("city") as string) || null,
      country_code: (formData.get("country_code") as string) || null,
      access_type: (formData.get("access_type") as string) || null,
      is_operational: formData.get("is_operational") === "1",
      max_power_kw: formData.get("max_power_kw") ? Number(formData.get("max_power_kw")) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chargePointId);

  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
}

/** Manuelle Korrektur der Anhaengertauglichkeit durch einen Admin --
 * schreibt direkt in enrich.trailer_suitability, UNABHAENGIG von der
 * community-basierten Meldungs-/Moderations-Warteschlange
 * (enrich.trailer_report / moderate_trailer_report). origin="admin_override"
 * und verified_by/verified_at machen den manuellen Ursprung nachvollziehbar. */
export async function overrideTrailerSuitability(chargePointKey: string, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  // enrich.app_user ist ein von auth.users ENTKOPPELTER Identitaetsraum --
  // per Konvention (siehe enrich.submit_trailer_report/moderate_trailer_report
  // in supabase/migrations/20260918000000_enrichment_endpoints.sql) wird
  // trotzdem dieselbe UUID wie in auth.users verwendet, verified_by
  // referenziert also KEINEN auth.users-Eintrag direkt, sondern setzt
  // voraus, dass vorher ein passender app_user existiert -- sonst schlaegt
  // der Foreign-Key auf trailer_suitability.verified_by fehl.
  await supabase.schema("enrich").from("app_user").upsert(
    { id: admin.id, display_name: admin.email, trust_level: 5 },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const verdict = formData.get("verdict") as TrailerVerdict;
  const maneuveringSpace = (formData.get("maneuvering_space") as string) || null;

  const { error } = await supabase.schema("enrich").from("trailer_suitability").upsert(
    {
      charge_point_key: chargePointKey,
      verdict,
      drive_through: formData.get("drive_through") === "1",
      pull_in_length_m: formData.get("pull_in_length_m") ? Number(formData.get("pull_in_length_m")) : null,
      maneuvering_space: maneuveringSpace as ManeuveringSpace | null,
      notes: (formData.get("notes") as string) || null,
      origin: "admin_override",
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "charge_point_key" }
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen`);
}

/** core.charge_point_geo (die einzige Quelle, aus der die Haupt-App
 * Ladestationen liest) ist eine einfache VIEW mit `where cp.is_active` --
 * kein Refresh noetig, die Aenderung wirkt sofort (siehe Migration
 * 20260909020000_campsite_charge_point_active_flag.sql). */
export async function setChargePointActive(chargePointId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.schema("core").from("charge_point").update({ is_active: isActive }).eq("id", chargePointId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
  revalidatePath("/ladestationen");
}

export async function deleteChargingReview(reviewId: string, chargePointId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("charging_reviews").delete().eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
}
