"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deriveCampsiteRating } from "@/lib/scoring/ev-camping-score";
import { actionErrorMessage, type ActionResult } from "@/lib/action-result";
import { requireActionRateLimit } from "@/lib/api-guard";

export async function addCampsiteReview(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Nicht angemeldet.");
    // Sicherheits-Audit: gleiches Limit wie das funktional analoge
    // POST /api/enrich/charge-points/{key}/trailer (trailer-report-submit).
    await requireActionRateLimit("add-campsite-review", user.id, { windowSeconds: 3600, maxRequests: 20 });

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

    // upsert statt insert: campsite_reviews hat unique(user_id, campsite_id)
    // (init_schema.sql) -- ein zweiter Bewertungsversuch (z. B. Doppel-Tap
    // ohne Pending-Feedback am Button, siehe review-form.tsx) schlug bisher
    // mit einer rohen, englischen Postgres-Constraint-Fehlermeldung fehl
    // (actionErrorMessage reicht sie unuebersetzt durch) statt die
    // bestehende Bewertung einfach zu aktualisieren -- das ist ohnehin das
    // erwartbare Verhalten ("meine Bewertung aendern").
    const { error } = await supabase.from("campsite_reviews").upsert(
      {
        user_id: user.id,
        campsite_id: campsiteId,
        rating: deriveCampsiteRating(chargingOnSiteBool, chargingWalkableBool),
        charging_on_site: chargingOnSiteBool,
        charging_walkable: chargingWalkableBool,
        comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
      },
      { onConflict: "user_id,campsite_id" }
    );

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
