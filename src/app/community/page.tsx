import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

export default async function CommunityPage() {
  const supabase = await createClient();

  const [{ data: campsiteReviews }, { data: chargingReviews }] = await Promise.all([
    supabase
      .from("campsite_reviews")
      .select("id, campsite_id, rating, comment, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("charging_reviews")
      .select("id, suitable, comment, created_at, charging_station_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type CampsiteReviewRow = {
    id: string;
    campsite_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  };
  type ChargingReviewRow = {
    id: string;
    suitable: "yes" | "no" | "limited";
    comment: string | null;
    created_at: string;
    charging_station_id: string;
  };

  const campsiteReviewList = (campsiteReviews as CampsiteReviewRow[] | null) ?? [];
  const campsiteIds = [...new Set(campsiteReviewList.map((r) => r.campsite_id))];
  const { data: campsites } = campsiteIds.length
    ? await supabase.schema("core").from("campsite").select("id, name").in("id", campsiteIds)
    : { data: [] as { id: string; name: string }[] };
  const campsiteById = new Map((campsites ?? []).map((c) => [c.id, c]));

  // Kein PostgREST-Embed -- charging_reviews.charging_station_id zeigt seit
  // Migration 20260916000000 auf core.charge_point statt public.
  // charging_stations, ein Embed unter dem alten Tabellennamen findet daher
  // keine passende FK-Relation mehr (siehe gleiches Muster in
  // profil/bewertungen/page.tsx).
  const chargingReviewList = (chargingReviews as ChargingReviewRow[] | null) ?? [];
  const chargingStationIds = [...new Set(chargingReviewList.map((r) => r.charging_station_id))];
  const { data: chargePoints } = chargingStationIds.length
    ? await supabase.schema("core").from("charge_point").select("id, name, operator").in("id", chargingStationIds)
    : { data: [] as { id: string; name: string | null; operator: string | null }[] };
  const chargePointById = new Map((chargePoints ?? []).map((c) => [c.id, c]));

  const activity = [
    ...campsiteReviewList.map((r) => {
      const campsite = campsiteById.get(r.campsite_id);
      return {
        id: `campsite-${r.id}`,
        createdAt: r.created_at,
        node: (
          <>
            <Link
              href={campsite ? `/campingplaetze/${campsite.id}` : "#"}
              className="font-medium text-route hover:underline"
            >
              {campsite?.name ?? "Campingplatz"}
            </Link>{" "}
            bewertet: ★ {r.rating}/5
            {r.comment && <span className="text-black/70 dark:text-white/70"> — „{r.comment}“</span>}
          </>
        ),
      };
    }),
    ...chargingReviewList.map((r) => {
      const chargePoint = chargePointById.get(r.charging_station_id);
      return {
      id: `charging-${r.id}`,
      createdAt: r.created_at,
      node: (
        <>
          <Link
            href={chargePoint ? `/ladepunkte/${chargePoint.id}` : "#"}
            className="font-medium text-route hover:underline"
          >
            {chargePoint?.name ?? chargePoint?.operator ?? "Ladepunkt"}
          </Link>{" "}
          bewertet: Gespann nutzbar? {SUITABLE_LABELS[r.suitable]}
          {r.comment && <span className="text-black/70 dark:text-white/70"> — „{r.comment}“</span>}
        </>
      ),
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Community</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Neueste Bewertungen von Campingplätzen und Ladepunkten.
      </p>

      {activity.length === 0 ? (
        <p className="mt-8 text-sm text-black/50 dark:text-white/50">
          Noch keine Community-Aktivität vorhanden.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {activity.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10"
            >
              {entry.node}
              <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                {new Date(entry.createdAt).toLocaleDateString("de-DE")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
