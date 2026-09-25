"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerificationStatus } from "@/lib/types";

// Siehe fahrzeugmodelle/actions.ts -- gleicher Grund (Audit-Befund 2026-09-22).
function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") throw new Error("Pflichtfeld fehlt.");
  return value.trim();
}

/** Uebernimmt einen Nutzer-Vorschlag (enrich.vehicle_model_suggestion) in
 * den Referenzkatalog -- legt die Katalogzeile ueber denselben Schreibpfad
 * wie "Fahrzeugmodell manuell anlegen" an (siehe fahrzeugmodelle/actions.ts
 * addVehicleModel) und schliesst den Vorschlag im selben Zug ab. Gleiches
 * Doppel-Klick-Guard-Muster wie approveMissingStationReport. */
export async function approveVehicleModelSuggestion(suggestionId: number, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { data: suggestion } = await supabase
    .schema("enrich")
    .from("vehicle_model_suggestion")
    .select("status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!suggestion || suggestion.status !== "pending") {
    throw new Error("Dieser Vorschlag wurde bereits bearbeitet.");
  }

  const { data: created, error } = await supabase
    .from("vehicle_models")
    .insert({
      manufacturer: requireString(formData.get("manufacturer")),
      model: requireString(formData.get("model")),
      variant: requireString(formData.get("variant")),
      battery_capacity_kwh: optionalNumber(formData.get("battery_capacity_kwh")),
      consumption_kwh_per_100km: optionalNumber(formData.get("consumption_kwh_per_100km")),
      charging_power_kw: optionalNumber(formData.get("charging_power_kw")),
      range_km: optionalNumber(formData.get("range_km")),
      max_towing_weight_braked_kg: optionalNumber(formData.get("max_towing_weight_braked_kg")),
      length_m: optionalNumber(formData.get("length_m")),
      source: (formData.get("source") as string)?.trim() || "user_suggestion",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .schema("enrich")
    .from("vehicle_model_suggestion")
    .update({
      status: "approved",
      created_model_id: created.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/fahrzeugmodelle");
  revalidatePath("/fahrzeugmodelle/vorschlaege");
  revalidatePath("/datenqualitaet/woche");
  redirect(`/fahrzeugmodelle/${created.id}`);
}

export async function rejectVehicleModelSuggestion(suggestionId: number) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .schema("enrich")
    .from("vehicle_model_suggestion")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/fahrzeugmodelle/vorschlaege");
  revalidatePath("/datenqualitaet/woche");
}
