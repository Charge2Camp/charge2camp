"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerificationStatus } from "@/lib/types";

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

/** Siehe fahrzeugmodelle/actions.ts addVehicleModel -- gleiches Prinzip fuer
 * Wohnwagen. */
export async function addCaravanModel(formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("caravan_models")
    .insert({
      manufacturer: requireString(formData.get("manufacturer")),
      model: requireString(formData.get("model")),
      series: (formData.get("series") as string)?.trim() || null,
      length_m: requireNumber(formData.get("length_m")),
      width_m: requireNumber(formData.get("width_m")),
      height_m: requireNumber(formData.get("height_m")),
      source: (formData.get("source") as string)?.trim() || "manual",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/wohnwagenmodelle");
  redirect(`/wohnwagenmodelle/${data.id}`);
}

export async function updateCaravanModel(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("caravan_models")
    .update({
      manufacturer: requireString(formData.get("manufacturer")),
      model: requireString(formData.get("model")),
      series: (formData.get("series") as string)?.trim() || null,
      length_m: requireNumber(formData.get("length_m")),
      width_m: requireNumber(formData.get("width_m")),
      height_m: requireNumber(formData.get("height_m")),
      source: (formData.get("source") as string)?.trim() || "manual",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/wohnwagenmodelle");
  revalidatePath(`/wohnwagenmodelle/${id}`);
}

/** caravans.model_reference_id verweist per "on delete set null" auf diesen
 * Katalog -- siehe deleteVehicleModel. */
export async function deleteCaravanModel(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("caravan_models").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/wohnwagenmodelle");
  redirect("/wohnwagenmodelle");
}
