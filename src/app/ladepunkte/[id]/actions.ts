"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalId(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
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
  const vehicleId = parseOptionalId(formData.get("vehicle_id"));
  const caravanId = parseOptionalId(formData.get("caravan_id"));

  if (typeof stationId !== "string" || !stationId) throw new Error("Ungültiger Ladepunkt.");
  if (suitable !== "yes" && suitable !== "no" && suitable !== "limited") {
    throw new Error("Bitte eine gültige Antwort auswählen.");
  }

  // Sicherstellen, dass referenziertes Fahrzeug/Wohnwagen tatsaechlich dem
  // angemeldeten Nutzer gehoert (RLS auf charging_reviews prueft das nicht).
  if (vehicleId) {
    const { data } = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", vehicleId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Ungültiges Fahrzeug.");
  }
  if (caravanId) {
    const { data } = await supabase
      .from("caravans")
      .select("id")
      .eq("id", caravanId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new Error("Ungültiger Wohnwagen.");
  }

  const { error } = await supabase.from("charging_reviews").insert({
    user_id: user.id,
    charging_station_id: stationId,
    suitable,
    vehicle_id: vehicleId,
    caravan_id: caravanId,
    decoupled_parking_possible:
      suitable === "limited" ? parseOptionalBoolean(formData.get("decoupled_parking_possible")) : null,
    enough_space_for_rig: parseOptionalBoolean(formData.get("enough_space_for_rig")),
    unobstructed_access: parseOptionalBoolean(formData.get("unobstructed_access")),
    no_barrier_or_garage: parseOptionalBoolean(formData.get("no_barrier_or_garage")),
    side_mounted_charger: parseOptionalBoolean(formData.get("side_mounted_charger")),
    trailer_length_m: parseOptionalNumber(formData.get("trailer_length_m")),
    trailer_width_m: parseOptionalNumber(formData.get("trailer_width_m")),
    caravan_model: typeof caravanModel === "string" && caravanModel.trim() ? caravanModel.trim() : null,
    comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/ladepunkte/${stationId}`);
}

/** Setzt/entfernt einen Ladepunkt als Favorit des angemeldeten Nutzers
 * (`favorites`-Tabelle, RLS beschraenkt bereits auf den eigenen Nutzer) --
 * analog zu toggleCampsiteFavorite in campingplaetze/[id]/actions.ts. */
export async function toggleChargingStationFavorite(stationId: string, isFavorite: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  if (isFavorite) {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, entity_type: "charging_station", entity_id: stationId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("entity_type", "charging_station")
      .eq("entity_id", stationId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/ladepunkte/${stationId}`);
  revalidatePath("/profil/favoriten");
}
