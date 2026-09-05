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
      .select("*, campsites(id, name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("charging_reviews")
      .select("*, charging_stations(id, name, provider)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="text-lg font-semibold">Meine Campingplatz-Bewertungen</h2>
        <div className="mt-4">
          <CampsiteReviewList reviews={(campsiteReviews as CampsiteReviewWithCampsite[]) ?? []} />
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
