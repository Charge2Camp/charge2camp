"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerificationStatus } from "@/lib/types";

// Alle Aufrufer sind physische Groessen (Batteriekapazitaet, Verbrauch,
// Ladeleistung, Reichweite, Anhaengelast, Laenge) -- 0 oder negativ ist
// fuer keine davon sinnvoll. Dieser Katalog landet direkt in der
// "Modell auswaehlen"-Dropdown der Haupt-App (siehe addVehicleModel-
// Kommentar) -- ein hier gespeicherter Negativwert wuerde sich potenziell
// auf viele Nutzerprofile gleichzeitig auswirken (Audit-Befund 2026-09-22,
// gleiche Klasse wie zuvor in src/app/profil/actions.ts gefixt).
function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") throw new Error("Pflichtfeld fehlt.");
  return value.trim();
}

/** Neues Fahrzeugmodell im Referenzkatalog anlegen (Nutzerwunsch: neue
 * Marktmodelle sollen ergaenzbar sein, ohne dass Nutzer sie nur manuell
 * eintippen koennen). Landet direkt in der "Modell auswählen"-Dropdown der
 * Haupt-App (VehicleForm), sobald verification_status/last_verified_at
 * nicht die Sichtbarkeit einschraenken -- public.vehicle_models hat keine
 * is_active-Spalte, jeder Eintrag ist sofort live. */
export async function addVehicleModel(formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { data, error } = await supabase
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
      source: (formData.get("source") as string)?.trim() || "manual",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/fahrzeugmodelle");
  redirect(`/fahrzeugmodelle/${data.id}`);
}

export async function updateVehicleModel(id: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("vehicle_models")
    .update({
      manufacturer: requireString(formData.get("manufacturer")),
      model: requireString(formData.get("model")),
      variant: requireString(formData.get("variant")),
      battery_capacity_kwh: optionalNumber(formData.get("battery_capacity_kwh")),
      consumption_kwh_per_100km: optionalNumber(formData.get("consumption_kwh_per_100km")),
      charging_power_kw: optionalNumber(formData.get("charging_power_kw")),
      range_km: optionalNumber(formData.get("range_km")),
      max_towing_weight_braked_kg: optionalNumber(formData.get("max_towing_weight_braked_kg")),
      length_m: optionalNumber(formData.get("length_m")),
      source: (formData.get("source") as string)?.trim() || "manual",
      verification_status: (formData.get("verification_status") as VerificationStatus) || "unverified",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/fahrzeugmodelle");
  revalidatePath(`/fahrzeugmodelle/${id}`);
}

/** vehicles.model_reference_id verweist per "on delete set null" auf diesen
 * Katalog (siehe Migration 20260905000000) -- bereits gespeicherte
 * Fahrzeuge von Nutzern verlieren beim Loeschen nur die Referenz, nicht
 * ihre eigenen (beim Anlegen kopierten) Werte. Loeschen ist also
 * gefahrlos. */
export async function deleteVehicleModel(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("vehicle_models").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fahrzeugmodelle");
  redirect("/fahrzeugmodelle");
}
