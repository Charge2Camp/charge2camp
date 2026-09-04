import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

export default async function CommunityPage() {
  const supabase = await createClient();

  const [{ data: campsiteReviews }, { data: chargingReviews }] = await Promise.all([
    supabase
      .from("campsite_reviews")
      .select("id, rating, comment, created_at, campsites(id, name)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("charging_reviews")
      .select("id, suitable, comment, created_at, charging_stations(id, name, provider)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type CampsiteReviewRow = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    campsites: { id: string; name: string } | null;
  };
  type ChargingReviewRow = {
    id: string;
    suitable: "yes" | "no" | "limited";
    comment: string | null;
    created_at: string;
    charging_stations: { id: string; name: string | null; provider: string } | null;
  };

  const activity = [
    ...((campsiteReviews as unknown as CampsiteReviewRow[] | null) ?? []).map((r) => ({
      id: `campsite-${r.id}`,
      createdAt: r.created_at,
      node: (
        <>
          <Link
            href={r.campsites ? `/campingplaetze/${r.campsites.id}` : "#"}
            className="font-medium text-emerald-600 hover:underline"
          >
            {r.campsites?.name ?? "Campingplatz"}
          </Link>{" "}
          bewertet: ★ {r.rating}/5
          {r.comment && <span className="text-black/70 dark:text-white/70"> — „{r.comment}“</span>}
        </>
      ),
    })),
    ...((chargingReviews as unknown as ChargingReviewRow[] | null) ?? []).map((r) => ({
      id: `charging-${r.id}`,
      createdAt: r.created_at,
      node: (
        <>
          <Link
            href={r.charging_stations ? `/ladepunkte/${r.charging_stations.id}` : "#"}
            className="font-medium text-emerald-600 hover:underline"
          >
            {r.charging_stations?.name ?? r.charging_stations?.provider ?? "Ladepunkt"}
          </Link>{" "}
          bewertet: Gespann nutzbar? {SUITABLE_LABELS[r.suitable]}
          {r.comment && <span className="text-black/70 dark:text-white/70"> — „{r.comment}“</span>}
        </>
      ),
    })),
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
