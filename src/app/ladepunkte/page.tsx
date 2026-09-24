import {
  fetchChargingStationNameOptions,
  fetchChargingStationOperatorOptions,
  fetchChargingStations,
  fetchFavoriteChargingStations,
  parseChargingStationFilters,
} from "@/lib/charging-stations";
import { isDefaultTrailerVerdict } from "@/lib/trailer-verdict";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/require-user";
import { ChargingStationFilterFields } from "@/components/charging-stations/filter-fields";
import { ChargingStationMapExplorer } from "@/components/charging-stations/charging-station-map-explorer";

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseChargingStationFilters(await searchParams);

  // Browsen erfordert Login (Sicherheits-Audit: Ladepunkte-Daten sind die
  // "DNA" des Produkts) -- siehe require-user.ts. Zusaetzliche
  // Absicherung auf Proxy-Ebene in src/proxy.ts.
  const user = await requireUser("/ladepunkte");
  const supabase = await createClient();

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
  // (300 ohne, 5000 mit Filter) statt hier schon alle 234.000+ Ladepunkte zu
  // laden -- das serverseitige Limit bestimmt NICHT mehr, welche Ladepunkte
  // langfristig sichtbar sind (das tat es fruehrer faelschlich: eine rein
  // alphabetische Sortierung nach Name blendete beim reinen Kartenbrowsen
  // saemtliche Namen ab ungefaehr "S" dauerhaft aus, siehe fetchChargingStations).
  // 1500 wurde nach dem Frankreich/Spanien-Import (10x mehr Ladepunkte) zu
  // langsam -- fetchChargingStations() + die connector/trailer-Anreicherung
  // (enrichStations(), 20 parallele Batch-Queries) brauchten dafuer
  // zusammen ca. 6s DB-Zeit bei schwankendem I/O-Durchsatz der Instanz und
  // ueberschritten das PostgREST-Statement-Timeout dadurch sporadisch.
  // "Nur Schnelllader" ist seit Nutzerwunsch der Default-Zustand (siehe
  // resolveFastChargersOnly in charging-stations.ts) und zaehlt deshalb
  // bewusst NICHT als "aktiver Filter" -- sonst wuerde die Badge/das
  // groessere Limit unten bei JEDEM Erstaufruf greifen, auch ohne dass der
  // Nutzer irgendetwas veraendert hat. Gleiches gilt seit 2026-09-24 fuer den
  // Anhaengertauglichkeits-Default (siehe DEFAULT_TRAILER_VERDICTS/
  // isDefaultTrailerVerdict in charging-stations.ts) -- isDefaultTrailerVerdict
  // ist deshalb hier (statt eines simplen .length > 0) noetig, um den
  // Default-Zustand von einer bewussten Nutzerauswahl zu unterscheiden.
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.connectorCategories.length > 0 ||
      !isDefaultTrailerVerdict(filters.trailerVerdict) ||
      filters.operators.length > 0
  );
  const stationLimit = hasActiveFilters ? 5000 : 300;
  const stations =
    filters.favoritesOnly && user
      ? await fetchFavoriteChargingStations(user.id)
      : await fetchChargingStations(filters, stationLimit);

  const [nameOptions, operatorOptions] = await Promise.all([
    fetchChargingStationNameOptions(),
    fetchChargingStationOperatorOptions(),
  ]);

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (isDefaultTrailerVerdict(filters.trailerVerdict) ? 0 : filters.trailerVerdict.length) +
    filters.connectorCategories.length +
    filters.operators.length;

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

      {/* Bewusst KEIN <form> hier aussen drum -- das wuerde sich um die
          gesamte Kartenansicht inkl. Bottom-Sheet legen und darin
          zwangsläufig auch das Bewertungsformular verschachteln (ungueltiges
          HTML, siehe charging-station-map-explorer.tsx). Das <form> fuer die
          Filterfelder liegt jetzt dort, enger um filterPanel gefasst. */}
      <ChargingStationMapExplorer
        initialStations={stations}
        filters={filters}
        homeAddress={homeAddress}
        emptyMessage={emptyMessage}
        activeFilterCount={activeFilterCount}
        isLoggedIn={Boolean(user)}
        filterPanel={
          <ChargingStationFilterFields
            filters={filters}
            isLoggedIn={Boolean(user)}
            nameOptions={nameOptions}
            operatorOptions={operatorOptions}
          />
        }
      />
    </div>
  );
}
