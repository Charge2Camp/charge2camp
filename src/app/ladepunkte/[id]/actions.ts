"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function addChargingReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const stationId = formData.get("charging_station_id");
  const suitable = formData.get("suitable");
  const comment = formData.get("comment");
  const caravanModel = formData.get("caravan_model");

  if (typeof stationId !== "string" || !stationId) throw new Error("Ungültiger Ladepunkt.");
  if (suitable !== "yes" && suitable !== "no" && suitable !== "limited") {
    throw new Error("Bitte eine gültige Antwort auswählen.");
  }

  const { error } = await supabase.from("charging_reviews").insert({
    user_id: user.id,
    charging_station_id: stationId,
    suitable,
    trailer_length_m: parseOptionalNumber(formData.get("trailer_length_m")),
    trailer_width_m: parseOptionalNumber(formData.get("trailer_width_m")),
    caravan_model: typeof caravanModel === "string" && caravanModel.trim() ? caravanModel.trim() : null,
    comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/ladepunkte/${stationId}`);
}
