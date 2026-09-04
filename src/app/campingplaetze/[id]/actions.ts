"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addCampsiteReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const campsiteId = formData.get("campsite_id");
  const rating = Number(formData.get("rating"));
  const comment = formData.get("comment");

  if (typeof campsiteId !== "string" || !campsiteId) throw new Error("Ungültiger Campingplatz.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Bewertung muss zwischen 1 und 5 liegen.");
  }

  const { error } = await supabase.from("campsite_reviews").insert({
    user_id: user.id,
    campsite_id: campsiteId,
    rating,
    comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}
