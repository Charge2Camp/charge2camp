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

  // Zuhause-Adresse fuer die initiale Kartenzentrierung (Nutzerwunsch,
  // statt des vorherigen -- zufällig wirkenden -- alphabetisch ersten
  // Ladepunkts der Server-Erstansicht, siehe ChargingStationMapExplorer).
  // Ohne hinterlegte Adresse faellt MapView auf den Deutschland-weiten
  // Standard-Ausschnitt zurueck.
  const { data: profile } = user
    ? await supabase.from("profiles").select("home_address, home_latitude, home_longitude").eq("id", user.id).maybeSingle()
    : { data: null };
  const homeAddress =
    profile?.home_address && profile.home_latitude != null && profile.home_longitude != null
      ? { latitude: profile.home_latitude, longitude: profile.home_longitude }
      : null;

  // Bewusst kartenzentriert (siehe charging-station-map-explorer.tsx): ohne
  // aktiven Filter zeigt die Karte einen geclusterten Ueberblick (wie auf
  // der Campingplaetze-Karte bereits erprobt) fuer den Ueberblick beim
  // Reiseplanen -- anders als vorher gibt es keinen "nur Favoriten"-
  // Startzustand mehr, Favoriten sind stattdessen ein expliziter Quick-
  // Filter (siehe favoritesOnly).
  //
  // `stations` hier ist nur die serverseitige ERSTANSICHT fuer den allerersten
  // Render (bevor die Karte im Browser ihren tatsaechlichen Kartenausschnitt
  // kennt) -- ChargingStationMapExplorer ersetzt sie kurz danach und bei
  // jedem Schwenken/Zoomen durch kartenausschnitt-basiert nachgeladene Daten
  // (/api/charge-points/viewport). Deshalb bewusst klein/ungefaehr belassen
  // (1500 ohne, 5000 mit Filter) statt hier schon alle 18.000+ Ladepunkte zu
  // laden -- das serverseitige Limit bestimmt NICHT mehr, welche Ladepunkte
  // langfristig sichtbar sind (das tat es fruehrer faelschlich: eine rein
  // alphabetische Sortierung nach Name blendete beim reinen Kartenbrowsen
  // saemtliche Namen ab ungefaehr "S" dauerhaft aus, siehe fetchChargingStations).
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
    // Mobil bewusst ohne Rand/Ueberschrift (Nutzerwunsch: Vollbild-Karte,
    // siehe charging-station-map-explorer.tsx) -- ab md unveraendert wie
    // zuvor, dort bleibt die Karte in der bekannten Box unter der Ueberschrift.
    <div className="md:mx-auto md:max-w-6xl md:px-4 md:py-6">
      <h1 className="hidden text-2xl font-semibold md:block">Ladepunkte</h1>

      <form action="/ladepunkte">
        <ChargingStationMapExplorer
          initialStations={stations}
          filters={filters}
          homeAddress={homeAddress}
          emptyMessage={emptyMessage}
          activeFilterCount={activeFilterCount}
          isLoggedIn={Boolean(user)}
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
