import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CampsiteReviewList,
  type CampsiteReviewWithCampsite,
} from "@/components/profile/campsite-review-list";
import {
  ChargingReviewList,
  type ChargingReviewWithStation,
} from "@/components/profile/charging-review-list";

export default async function BewertungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: campsiteReviews }, { data: chargingReviews }] = await Promise.all([
    supabase
      .from("campsite_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("charging_reviews")
      .select("*, charging_stations(id, name, provider)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const campsiteReviewRows = (campsiteReviews as CampsiteReviewWithCampsite[] | null) ?? [];
  const campsiteIds = [...new Set(campsiteReviewRows.map((r) => r.campsite_id))];
  const { data: campsites } = campsiteIds.length
    ? await supabase.schema("core").from("campsite").select("id, name").in("id", campsiteIds)
    : { data: [] as { id: string; name: string }[] };
  const campsiteById = new Map((campsites ?? []).map((c) => [c.id, c]));
  const campsiteReviewsWithCampsite = campsiteReviewRows.map((r) => ({
    ...r,
    campsites: campsiteById.get(r.campsite_id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="text-lg font-semibold">Meine Campingplatz-Bewertungen</h2>
        <div className="mt-4">
          <CampsiteReviewList reviews={campsiteReviewsWithCampsite} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Meine Ladepunkt-Bewertungen</h2>
        <div className="mt-4">
          <ChargingReviewList reviews={(chargingReviews as ChargingReviewWithStation[]) ?? []} />
        </div>
      </section>
    </div>
  );
}
