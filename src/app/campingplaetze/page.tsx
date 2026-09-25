import {
  fetchAmenityCatalog,
  fetchCampsiteCountryOptions,
  fetchCampsiteNameOptions,
  fetchCampsites,
  fetchFavoriteCampsites,
  parseCampsiteFilters,
} from "@/lib/campsites";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/require-user";
import { CampsiteFilterForm } from "@/components/campsites/filter-form";
import { CampsiteQuickFilters } from "@/components/campsites/quick-filters";
import { FurtherFiltersSheet } from "@/components/further-filters-sheet";
import { CampsiteExplorer } from "@/components/campsites/campsite-explorer";

export default async function CampsitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const amenityCatalog = await fetchAmenityCatalog();
  const filters = parseCampsiteFilters(
    resolvedSearchParams,
    amenityCatalog.map((a) => a.key)
  );

  // Ohne jeden Filter waere die Liste die komplette, bis zu 5000
  // Eintraege umfassende Rohmenge -- weder uebersichtlich noch fuer den
  // Nutzer sinnvoll als Startzustand. Stattdessen zeigen wir die eigenen
  // Favoriten (falls angemeldet); die volle Liste gibt es erst, sobald
  // mindestens ein Filter aktiv ist.
  const hasActiveFilters = Boolean(
    filters.q || filters.country || filters.charging || filters.amenities.length > 0
  );

  // Browsen erfordert Login (Sicherheits-Audit: Campingplatz-Daten sind
  // die "DNA" des Produkts) -- siehe require-user.ts. Zusaetzliche
  // Absicherung auf Proxy-Ebene in src/proxy.ts.
  const user = await requireUser("/campingplaetze");
  const supabase = await createClient();

  const [campsites, countries, nameOptions, { data: profile }] = await Promise.all([
    hasActiveFilters ? fetchCampsites(filters) : user ? fetchFavoriteCampsites(user.id) : Promise.resolve([]),
    fetchCampsiteCountryOptions(),
    fetchCampsiteNameOptions(),
    user
      ? supabase.from("profiles").select("home_address, home_latitude, home_longitude").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Zuhause-Adresse fuer die initiale Kartenzentrierung, wenn (noch) keine
  // Marker angezeigt werden (kein Filter aktiv und keine/keine eigenen
  // Favoriten, siehe CampsiteExplorer) -- statt des generischen
  // Deutschland-weiten Standard-Ausschnitts (gleiches Prinzip wie auf
  // /ladepunkte). Sobald Marker vorhanden sind (Favoriten oder gefilterte
  // Treffer), zentriert sich die Karte weiterhin auf DIESE (fitBounds,
  // unveraendert) -- die Zuhause-Adresse greift nur als Ausgangspunkt,
  // wenn es noch nichts anderes zu zentrieren gibt.
  const homeAddress =
    profile?.home_address && profile.home_latitude != null && profile.home_longitude != null
      ? { latitude: profile.home_latitude, longitude: profile.home_longitude }
      : null;

  const evAmenityKeys = new Set(amenityCatalog.filter((a) => a.category === "laden").map((a) => a.key));
  const furtherFilterCount =
    (filters.q ? 1 : 0) + filters.amenities.filter((key) => !evAmenityKeys.has(key)).length;

  let heading: string;
  let emptyMessage: string;
  if (hasActiveFilters) {
    heading =
      campsites.length >= 5000
        ? `Mindestens ${campsites.length} Campingplätze gefunden -- Filter eingrenzen für vollständige Ergebnisse`
        : `${campsites.length} Campingplätze gefunden`;
    emptyMessage = "Keine Campingplätze gefunden. Filter anpassen?";
  } else if (user) {
    heading =
      campsites.length > 0
        ? "Deine gemerkten Campingplätze -- filtern, um alle zu durchsuchen"
        : "Noch keine Favoriten gemerkt -- filtern, um Campingplätze zu durchsuchen";
    emptyMessage =
      "Noch keine Favoriten gemerkt. Auf der Detailseite eines Campingplatzes über das Herz-Symbol merken, oder Filter setzen, um alle zu durchsuchen.";
  } else {
    heading = "Filtern, um Campingplätze zu durchsuchen, oder anmelden, um Favoriten zu sehen";
    emptyMessage = "Filter setzen, um Campingplätze zu durchsuchen.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Campingplätze</h1>
      <p className="mt-1 text-sm text-text-muted">{heading}</p>

      <form action="/campingplaetze" className="mt-8 flex flex-col gap-4">
        <CampsiteQuickFilters filters={filters} countries={countries} amenityCatalog={amenityCatalog} />

        <FurtherFiltersSheet activeFilterCount={furtherFilterCount}>
          <CampsiteFilterForm filters={filters} amenityCatalog={amenityCatalog} nameOptions={nameOptions} />
        </FurtherFiltersSheet>
      </form>

      <div className="mt-8">
        <CampsiteExplorer
          campsites={campsites}
          amenityLabels={Object.fromEntries(amenityCatalog.map((a) => [a.key, a.label_de]))}
          emptyMessage={emptyMessage}
          homeAddress={homeAddress}
        />
      </div>
    </div>
  );
}
