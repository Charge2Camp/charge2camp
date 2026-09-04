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
    max_towing_weight_braked_kg: parseOptionalNumber(formData.get("max_towing_weight_braked_kg")),
    length_m: parseOptionalNumber(formData.get("length_m")),
    model_reference_id: formData.get("model_reference_id") || null,
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
    model_reference_id: formData.get("model_reference_id") || null,
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

export async function updateCampsiteReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const campsiteId = formData.get("campsite_id");
  const rating = Number(formData.get("rating"));
  const comment = formData.get("comment");

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Bewertung muss zwischen 1 und 5 liegen.");
  }

  const { error } = await supabase
    .from("campsite_reviews")
    .update({
      rating,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  if (typeof campsiteId === "string" && campsiteId) revalidatePath(`/campingplaetze/${campsiteId}`);
}

export async function deleteCampsiteReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const campsiteId = formData.get("campsite_id");

  const { error } = await supabase
    .from("campsite_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  if (typeof campsiteId === "string" && campsiteId) revalidatePath(`/campingplaetze/${campsiteId}`);
}

export async function updateChargingReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const stationId = formData.get("charging_station_id");
  const suitable = formData.get("suitable");
  const comment = formData.get("comment");
  const caravanModel = formData.get("caravan_model");

  if (suitable !== "yes" && suitable !== "no" && suitable !== "limited") {
    throw new Error("Bitte eine gültige Antwort auswählen.");
  }

  const { error } = await supabase
    .from("charging_reviews")
    .update({
      suitable,
      trailer_length_m: parseOptionalNumber(formData.get("trailer_length_m")),
      trailer_width_m: parseOptionalNumber(formData.get("trailer_width_m")),
      caravan_model:
        typeof caravanModel === "string" && caravanModel.trim() ? caravanModel.trim() : null,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  if (typeof stationId === "string" && stationId) revalidatePath(`/ladepunkte/${stationId}`);
}

export async function deleteChargingReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const stationId = formData.get("charging_station_id");

  const { error } = await supabase
    .from("charging_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  if (typeof stationId === "string" && stationId) revalidatePath(`/ladepunkte/${stationId}`);
}
