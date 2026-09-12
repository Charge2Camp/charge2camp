"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveCampsiteRating } from "@/lib/scoring/ev-camping-score";
import { actionErrorMessage, type ActionResult } from "@/lib/action-result";

export async function addCampsiteReview(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht angemeldet.");

    const campsiteId = formData.get("campsite_id");
    const chargingOnSite = formData.get("charging_on_site");
    const chargingWalkable = formData.get("charging_walkable");
    const comment = formData.get("comment");

    if (typeof campsiteId !== "string" || !campsiteId) throw new Error("Ungültiger Campingplatz.");
    if (chargingOnSite !== "yes" && chargingOnSite !== "no") {
      throw new Error("Bitte angeben, ob Laden auf dem Platz möglich ist.");
    }
    if (chargingWalkable !== "yes" && chargingWalkable !== "no") {
      throw new Error("Bitte angeben, ob eine nutzbare Ladelösung fußläufig erreichbar ist.");
    }

    const chargingOnSiteBool = chargingOnSite === "yes";
    const chargingWalkableBool = chargingWalkable === "yes";

    const { error } = await supabase.from("campsite_reviews").insert({
      user_id: user.id,
      campsite_id: campsiteId,
      rating: deriveCampsiteRating(chargingOnSiteBool, chargingWalkableBool),
      charging_on_site: chargingOnSiteBool,
      charging_walkable: chargingWalkableBool,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/campingplaetze/${campsiteId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: actionErrorMessage(err, "Bewertung konnte nicht gespeichert werden.") };
  }
}

/** Setzt/entfernt einen Campingplatz als Favorit des angemeldeten Nutzers
 * (`favorites`-Tabelle, RLS beschraenkt bereits auf den eigenen Nutzer). */
export async function toggleCampsiteFavorite(campsiteId: string, isFavorite: boolean): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht angemeldet.");

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, entity_type: "campsite", entity_id: campsiteId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("entity_type", "campsite")
        .eq("entity_id", campsiteId);
      if (error) throw new Error(error.message);
    }

    revalidatePath(`/campingplaetze/${campsiteId}`);
    revalidatePath("/profil/favoriten");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: actionErrorMessage(err, "Favorit konnte nicht gespeichert werden.") };
  }
}
