"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireNumber(value: FormDataEntryValue | null): number {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) throw new Error("Pflichtfeld fehlt oder ist keine Zahl.");
  return parsed;
}

function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error("Pflichtfeld fehlt.");
  }
  return value.trim();
}

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return { supabase, userId: user.id };
}

export async function addVehicle(formData: FormData) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("vehicles").insert({
    user_id: userId,
    manufacturer: requireString(formData.get("manufacturer")),
    model: requireString(formData.get("model")),
    battery_capacity_kwh: requireNumber(formData.get("battery_capacity_kwh")),
    consumption_kwh_per_100km: parseOptionalNumber(formData.get("consumption_kwh_per_100km")),
    charging_power_kw: parseOptionalNumber(formData.get("charging_power_kw")),
    range_km: parseOptionalNumber(formData.get("range_km")),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
}

export async function deleteVehicle(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));

  const { error } = await supabase.from("vehicles").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil");
}

export async function addCaravan(formData: FormData) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("caravans").insert({
    user_id: userId,
    manufacturer: requireString(formData.get("manufacturer")),
    model: requireString(formData.get("model")),
    length_m: requireNumber(formData.get("length_m")),
    width_m: requireNumber(formData.get("width_m")),
    height_m: requireNumber(formData.get("height_m")),
    weight_kg: requireNumber(formData.get("weight_kg")),
    gross_vehicle_weight_kg: parseOptionalNumber(formData.get("gross_vehicle_weight_kg")),
    actual_travel_weight_kg: parseOptionalNumber(formData.get("actual_travel_weight_kg")),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
}

export async function deleteCaravan(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));

  const { error } = await supabase.from("caravans").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil");
}
