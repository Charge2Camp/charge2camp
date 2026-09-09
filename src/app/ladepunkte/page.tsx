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
import { ChargingStationMapExplorer } from "@/components/charging-stations/charging-station-map-explorer";

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseChargingStationFilters(await searchParams);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bewusst kartenzentriert (siehe charging-station-map-explorer.tsx): ohne
  // aktiven Filter zeigt die Karte einen geclusterten Ueberblick (wie auf
  // der Campingplaetze-Karte bereits erprobt) fuer den Ueberblick beim
  // Reiseplanen -- anders als vorher gibt es keinen "nur Favoriten"-
  // Startzustand mehr, Favoriten sind stattdessen ein expliziter Quick-
  // Filter (siehe favoritesOnly). Ohne jeden Filter bewusst auf 1500 statt
  // 5000 begrenzt (siehe fetchChargingStations) -- bei ueber 18.000 echten
  // Ladepunkten insgesamt waere der ungefilterte Erstueberblick sonst
  // spuerbar langsam; sobald gezielt gefiltert wird, gilt wieder das volle
  // Limit.
  const hasActiveFilters = Boolean(
    filters.q || filters.connectorType || filters.fastChargersOnly || filters.trailerVerdict.length > 0
  );
  const stationLimit = hasActiveFilters ? 5000 : 1500;
  const stations =
    filters.favoritesOnly && user
      ? await fetchFavoriteChargingStations(user.id)
      : await fetchChargingStations(filters, stationLimit);

  const [connectorTypes, nameOptions] = await Promise.all([
    fetchConnectorTypeOptions(),
    fetchChargingStationNameOptions(),
  ]);

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.connectorType ? 1 : 0) +
    (filters.fastChargersOnly ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    filters.trailerVerdict.length;

  let emptyMessage: string;
  if (filters.favoritesOnly) {
    emptyMessage = user
      ? "Noch keine Favoriten gemerkt. Auf der Detailseite eines Ladepunkts über das Herz-Symbol merken."
      : "Anmelden, um Favoriten zu sehen.";
  } else {
    emptyMessage = "Keine Ladepunkte gefunden. Filter anpassen?";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Ladepunkte</h1>

      <form action="/ladepunkte">
        <ChargingStationMapExplorer
          stations={stations}
          stationCountLabel={stations.length >= stationLimit ? `${stations.length}+` : `${stations.length}`}
          emptyMessage={emptyMessage}
          activeFilterCount={activeFilterCount}
          filterPanel={
            <div className="flex flex-col gap-6">
              <ChargingStationQuickFilters filters={filters} isLoggedIn={Boolean(user)} />
              <hr className="border-black/10 dark:border-white/10" />
              <ChargingStationFilterForm filters={filters} connectorTypes={connectorTypes} nameOptions={nameOptions} />
            </div>
          }
        />
      </form>
    </div>
  );
}
