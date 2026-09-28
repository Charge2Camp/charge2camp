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
import { CampsiteSearchClient } from "@/components/campsites/campsite-search-client";
import { FavoritesQuickList } from "@/components/campsites/favorites-quick-list";

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

  // Ohne jeden Filter waere die Liste die komplette, bis zu 5000 Eintraege
  // umfassende Rohmenge -- weder uebersichtlich noch fuer den Nutzer
  // sinnvoll als Startzustand. Anders als frueher zeigen wir dafuer NICHT
  // mehr die Favoriten in der Ergebnisliste (die haben jetzt ihre eigene,
  // immer sichtbare Kurzliste direkt unter den Filtern, siehe
  // FavoritesQuickList) -- die Ergebnisliste bleibt dadurch ausschliesslich
  // fuer echte Filterergebnisse reserviert, ohne zwei Stellen mit
  // ueberschneidendem Inhalt (siehe docs/DESIGN_DECISIONS.md).
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.country ||
      filters.charging ||
      filters.evScoreMin ||
      filters.ratingMin ||
      filters.near ||
      filters.amenities.length > 0
  );

  // Browsen erfordert Login (Sicherheits-Audit: Campingplatz-Daten sind
  // die "DNA" des Produkts) -- siehe require-user.ts. Zusaetzliche
  // Absicherung auf Proxy-Ebene in src/proxy.ts.
  const user = await requireUser("/campingplaetze");
  const supabase = await createClient();

  const [campsites, favoriteCampsites, countries, nameOptions, { data: profile }] = await Promise.all([
    hasActiveFilters ? fetchCampsites(filters) : Promise.resolve([]),
    user ? fetchFavoriteCampsites(user.id) : Promise.resolve([]),
    fetchCampsiteCountryOptions(),
    fetchCampsiteNameOptions(),
    user
      ? supabase.from("profiles").select("home_address, home_latitude, home_longitude").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Zuhause-Adresse fuer die initiale Kartenzentrierung, wenn (noch) keine
  // Marker angezeigt werden, statt des generischen Deutschland-weiten
  // Standard-Ausschnitts (gleiches Prinzip wie auf /ladepunkte).
  const homeAddress =
    profile?.home_address && profile.home_latitude != null && profile.home_longitude != null
      ? { latitude: profile.home_latitude, longitude: profile.home_longitude }
      : null;

  let heading: string;
  let emptyMessage: string;
  if (hasActiveFilters) {
    const nearSuffix = filters.near ? ` im Umkreis von ${filters.radiusKm} km um ${filters.near.label}` : "";
    heading =
      campsites.length >= 5000
        ? `Mindestens ${campsites.length} Campingplätze gefunden -- Filter eingrenzen für vollständige Ergebnisse`
        : `${campsites.length} Campingplätze gefunden${nearSuffix}`;
    emptyMessage = filters.near
      ? "Keine Campingplätze in diesem Umkreis gefunden. Radius vergrößern oder Filter anpassen?"
      : "Keine Campingplätze gefunden. Filter anpassen?";
  } else if (user) {
    heading = "Filtern, um Campingplätze zu durchsuchen";
    emptyMessage = "Filter setzen, um Campingplätze zu durchsuchen.";
  } else {
    heading = "Filtern, um Campingplätze zu durchsuchen, oder anmelden, um Favoriten zu sehen";
    emptyMessage = "Filter setzen, um Campingplätze zu durchsuchen.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Campingplätze</h1>
      <p className="mt-1 text-sm text-text-muted">{heading}</p>

      <div className="mt-8">
        <CampsiteSearchClient
          filters={filters}
          campsites={campsites}
          countries={countries}
          amenityCatalog={amenityCatalog}
          nameOptions={nameOptions}
          emptyMessage={emptyMessage}
          homeAddress={homeAddress}
        >
          <FavoritesQuickList favorites={favoriteCampsites} />
        </CampsiteSearchClient>
      </div>
    </div>
  );
}
