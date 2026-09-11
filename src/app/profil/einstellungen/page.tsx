import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BlockedStationsList, type BlockedStationOption } from "@/components/profile/blocked-stations-list";

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: blocked } = await supabase
    .from("blocked_charging_stations")
    .select("charging_station_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const blockedStationIds = (blocked ?? []).map((row) => row.charging_station_id);
  const { data: stations } = blockedStationIds.length
    ? await supabase.schema("core").from("charge_point").select("id, name, operator").in("id", blockedStationIds)
    : { data: [] as { id: string; name: string | null; operator: string | null }[] };

  const stationById = new Map((stations ?? []).map((s) => [s.id, s]));
  // Reihenfolge (zuletzt blockiert zuerst) aus blockedStationIds beibehalten,
  // nicht die vom `in`-Filter zurueckgegebene DB-Reihenfolge.
  const blockedStations: BlockedStationOption[] = blockedStationIds.map(
    (id) => stationById.get(id) ?? { id, name: null, operator: null }
  );

  return (
    <section>
      <h2 className="text-lg font-semibold">Einstellungen</h2>
      <p className="mt-4 text-sm text-black/60 dark:text-white/60">
        Es gibt aktuell noch keine App-Einstellungen (z. B. Sprache, Benachrichtigungen). Diese
        Seite folgt in einer späteren Phase.
      </p>

      <div className="mt-10">
        <h3 className="font-semibold">Blockierte Ladepunkte</h3>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Diese Ladepunkte werden bei der Routenplanung nie als Ladestopp vorgeschlagen. Blockieren
          lässt sich ein Ladepunkt über &quot;Zukünftig nicht berücksichtigen&quot; auf seiner
          Detailseite.
        </p>
        <div className="mt-4">
          <BlockedStationsList stations={blockedStations} />
        </div>
      </div>
    </section>
  );
}
