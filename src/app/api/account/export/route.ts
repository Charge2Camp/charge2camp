import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DSGVO-Datenexport (§ "Export personenbezogener Daten", docs/privacy.md,
 * bislang "noch nicht implementiert"). Liefert alle Daten, die dem
 * eingeloggten Nutzer gehoeren, als JSON-Download -- kein Admin-Client
 * noetig, die normalen RLS-Policies ("... are managed by their owner")
 * sorgen ohnehin dafuer, dass nur eigene Zeilen zurueckkommen.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const [profile, vehicles, caravans, favorites, campsiteReviews, chargingReviews, savedRoutes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("vehicles").select("*").eq("user_id", user.id),
    supabase.from("caravans").select("*").eq("user_id", user.id),
    supabase.from("favorites").select("*").eq("user_id", user.id),
    supabase.from("campsite_reviews").select("*").eq("user_id", user.id),
    supabase.from("charging_reviews").select("*").eq("user_id", user.id),
    supabase.from("saved_routes").select("*").eq("user_id", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    vehicles: vehicles.data ?? [],
    caravans: caravans.data ?? [],
    favorites: favorites.data ?? [],
    campsite_reviews: campsiteReviews.data ?? [],
    charging_reviews: chargingReviews.data ?? [],
    saved_routes: savedRoutes.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="charge2camp-daten-${user.id}.json"`,
    },
  });
}
