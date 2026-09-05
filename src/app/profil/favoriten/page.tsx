import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Favorite } from "@/types/database";

export default async function FavoritenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: favorites } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const favoriteList = (favorites as Favorite[]) ?? [];
  const campsiteIds = favoriteList.filter((f) => f.entity_type === "campsite").map((f) => f.entity_id);
  const stationIds = favoriteList
    .filter((f) => f.entity_type === "charging_station")
    .map((f) => f.entity_id);

  const [{ data: campsites }, { data: stations }] = await Promise.all([
    campsiteIds.length
      ? supabase.from("campsites").select("id, name").in("id", campsiteIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    stationIds.length
      ? supabase.from("charging_stations").select("id, name, provider").in("id", stationIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; provider: string }[] }),
  ]);

  const campsiteById = new Map((campsites ?? []).map((c) => [c.id, c]));
  const stationById = new Map((stations ?? []).map((s) => [s.id, s]));

  return (
    <section>
      <h2 className="text-lg font-semibold">Favoriten</h2>

      {favoriteList.length === 0 ? (
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">Noch keine Favoriten gemerkt.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {favoriteList.map((favorite) => {
            if (favorite.entity_type === "campsite") {
              const campsite = campsiteById.get(favorite.entity_id);
              return (
                <li
                  key={`${favorite.entity_type}-${favorite.entity_id}`}
                  className="rounded-md border border-black/10 px-4 py-3 text-sm dark:border-white/10"
                >
                  <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                    Campingplatz
                  </span>
                  {campsite ? (
                    <Link href={`/campingplaetze/${campsite.id}`} className="hover:underline">
                      {campsite.name}
                    </Link>
                  ) : (
                    <span className="text-black/50 dark:text-white/50">Campingplatz nicht mehr verfügbar</span>
                  )}
                </li>
              );
            }
            const station = stationById.get(favorite.entity_id);
            return (
              <li
                key={`${favorite.entity_type}-${favorite.entity_id}`}
                className="rounded-md border border-black/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  Ladepunkt
                </span>
                {station ? (
                  <Link href={`/ladepunkte/${station.id}`} className="hover:underline">
                    {station.name ?? station.provider}
                  </Link>
                ) : (
                  <span className="text-black/50 dark:text-white/50">Ladepunkt nicht mehr verfügbar</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-black/50 dark:text-white/50">
        Das Merken von Campingplätzen/Ladepunkten über einen Favoriten-Button auf den Detailseiten
        ist noch nicht umgesetzt und folgt in einer späteren Phase.
      </p>
    </section>
  );
}
