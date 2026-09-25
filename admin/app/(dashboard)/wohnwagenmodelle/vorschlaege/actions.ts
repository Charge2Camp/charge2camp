"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerificationStatus } from "@/lib/types";

// Siehe wohnwagenmodelle/actions.ts -- gleicher Grund (Audit-Befund 2026-09-22).
function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") throw new Error("Pflichtfeld fehlt.");
  return value.trim();
}

function requireNumber(value: FormDataEntryValue | null): number {
  const parsed = optionalNumber(value);
  if (parsed === null) throw new Error("Pflichtfeld fehlt oder ist keine Zahl.");
  return parsed;
}

/** Siehe fahrzeugmodelle/vorschlaege/actions.ts approveVehicleModelSuggestion
 * -- gleiches Prinzip fuer Wohnwagen. */
export async function approveCaravanModelSuggestion(suggestionId: number, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { data: suggestion } = await supabase
    .schema("enrich")
    .from("caravan_model_suggestion")
    .select("status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!suggestion || suggestion.status !== "pending") {
    throw new Error("Dieser Vorschlag wurde bereits bearbeitet.");
  }

  const { data: created, error } = await supabase
    .from("caravan_models")
    .insert({
      manufacturer: requireString(formData.get("manufacturer")),
      model: requireString(formData.get("model")),
      series: (formData.get("series") as string)?.trim() || null,
      length_m: requireNumber(formData.get("length_m")),
      width_m: requireNumber(formData.get("width_m")),
      height_m: requireNumber(formData.get("height_m")),
      source: (formData.get("source") as string)?.trim() || "user_suggestion",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .schema("enrich")
    .from("caravan_model_suggestion")
    .update({
      status: "approved",
      created_model_id: created.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/wohnwagenmodelle");
  revalidatePath("/wohnwagenmodelle/vorschlaege");
  revalidatePath("/datenqualitaet/woche");
  redirect(`/wohnwagenmodelle/${created.id}`);
}

export async function rejectCaravanModelSuggestion(suggestionId: number) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .schema("enrich")
    .from("caravan_model_suggestion")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath("/wohnwagenmodelle/vorschlaege");
  revalidatePath("/datenqualitaet/woche");
}
