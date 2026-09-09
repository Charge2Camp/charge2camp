import {
  fetchChargingStationNameOptions,
  fetchChargingStations,
  fetchConnectorTypeOptions,
  fetchFavoriteChargingStations,
  parseChargingStationFilters,
} from "@/lib/charging-stations";
import { createClient } from "@/lib/supabase/server";
import { ChargingStationFilterForm } from "@/components/charging-stations/filter-form";
import { ChargingStationQuickFilters } from "@/components/charging-stations/quick-filters";
import { FurtherFiltersSheet } from "@/components/further-filters-sheet";
import { ChargingStationExplorer } from "@/components/charging-stations/charging-station-explorer";

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseChargingStationFilters(await searchParams);

  // Ohne jeden Filter waere die Liste die komplette, bis zu 5000 Eintraege
  // umfassende Rohmenge -- weder uebersichtlich noch ein sinnvoller
  // Startzustand (gleiches Muster wie campingplaetze/page.tsx). Stattdessen
  // zeigen wir die eigenen Favoriten (falls angemeldet); die volle Liste
  // gibt es erst, sobald mindestens ein Filter aktiv ist.
  const hasActiveFilters = Boolean(
    filters.q || filters.connectorType || filters.fastChargersOnly || filters.trailerVerdict.length > 0
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stations, connectorTypes, nameOptions] = await Promise.all([
    hasActiveFilters
      ? fetchChargingStations(filters)
      : user
        ? fetchFavoriteChargingStations(user.id)
        : Promise.resolve([]),
    fetchConnectorTypeOptions(),
    fetchChargingStationNameOptions(),
  ]);

  const furtherFilterCount = (filters.q ? 1 : 0) + (filters.connectorType ? 1 : 0);

  let heading: string;
  let emptyMessage: string;
  if (hasActiveFilters) {
    heading =
      stations.length >= 5000
        ? `Mindestens ${stations.length} Ladepunkte gefunden -- Filter eingrenzen für vollständige Ergebnisse`
        : `${stations.length} Ladepunkte gefunden`;
    emptyMessage = "Keine Ladepunkte gefunden. Filter anpassen?";
  } else if (user) {
    heading =
      stations.length > 0
        ? "Deine gemerkten Ladepunkte -- filtern, um alle zu durchsuchen"
        : "Noch keine Favoriten gemerkt -- filtern, um Ladepunkte zu durchsuchen";
    emptyMessage =
      "Noch keine Favoriten gemerkt. Auf der Detailseite eines Ladepunkts über das Herz-Symbol merken, oder Filter setzen, um alle zu durchsuchen.";
  } else {
    heading = "Filtern, um Ladepunkte zu durchsuchen, oder anmelden, um Favoriten zu sehen";
    emptyMessage = "Filter setzen, um Ladepunkte zu durchsuchen.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Ladepunkte</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{heading}</p>

      <form action="/ladepunkte" className="mt-8 flex flex-col gap-4">
        <ChargingStationQuickFilters filters={filters} />

        <FurtherFiltersSheet activeFilterCount={furtherFilterCount}>
          <ChargingStationFilterForm filters={filters} connectorTypes={connectorTypes} nameOptions={nameOptions} />
        </FurtherFiltersSheet>
      </form>

      <div className="mt-8">
        <ChargingStationExplorer stations={stations} emptyMessage={emptyMessage} />
      </div>
    </div>
  );
}
