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
      .select("*")
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

  // Kein PostgREST-Embed (wie oben bei campsites) -- charging_reviews.
  // charging_station_id zeigt seit Migration 20260916000000 auf
  // core.charge_point statt public.charging_stations, ein Embed unter dem
  // alten Tabellennamen "charging_stations" findet daher keine passende
  // FK-Relation mehr und liefert null, wodurch die Bewertungen im Profil
  // unsichtbar wirkten (Link/Name fehlten, siehe ChargingReviewList).
  const chargingReviewRows = (chargingReviews as ChargingReviewWithStation[] | null) ?? [];
  const chargingStationIds = [...new Set(chargingReviewRows.map((r) => r.charging_station_id))];
  const { data: chargePoints } = chargingStationIds.length
    ? await supabase.schema("core").from("charge_point").select("id, name, operator").in("id", chargingStationIds)
    : { data: [] as { id: string; name: string | null; operator: string | null }[] };
  const chargePointById = new Map((chargePoints ?? []).map((c) => [c.id, c]));
  const chargingReviewsWithStation = chargingReviewRows.map((r) => ({
    ...r,
    charging_stations: chargePointById.get(r.charging_station_id) ?? null,
  }));

  return (
    <div>
      <h2 className="text-lg font-semibold">Bewertungen</h2>

      <div className="mt-6 flex flex-col gap-12">
        <section>
          <h3 className="font-semibold">Meine Campingplatz-Bewertungen</h3>
          <div className="mt-4">
            <CampsiteReviewList reviews={campsiteReviewsWithCampsite} />
          </div>
        </section>

        <section>
          <h3 className="font-semibold">Meine Ladepunkt-Bewertungen</h3>
          <div className="mt-4">
            <ChargingReviewList reviews={chargingReviewsWithStation} />
          </div>
        </section>
      </div>
    </div>
  );
}
