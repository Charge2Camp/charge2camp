import {
  fetchAmenityCatalog,
  fetchCampsiteCountryOptions,
  fetchCampsiteNameOptions,
  fetchCampsites,
  parseCampsiteFilters,
} from "@/lib/campsites";
import { CampsiteFilterForm } from "@/components/campsites/filter-form";
import { CampsiteExplorer } from "@/components/campsites/campsite-explorer";
import { MobileFilterSheet } from "@/components/mobile-filter-sheet";

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
  const [campsites, countries, nameOptions] = await Promise.all([
    fetchCampsites(filters),
    fetchCampsiteCountryOptions(),
    fetchCampsiteNameOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Campingplätze</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        {campsites.length >= 5000
          ? `Mindestens ${campsites.length} Campingplätze gefunden -- Filter eingrenzen für vollständige Ergebnisse`
          : `${campsites.length} Campingplätze gefunden`}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
          <CampsiteFilterForm
            filters={filters}
            countries={countries}
            amenityCatalog={amenityCatalog}
            nameOptions={nameOptions}
          />
        </aside>

        <div>
          <MobileFilterSheet
            activeFilterCount={
              (filters.q ? 1 : 0) + (filters.country ? 1 : 0) + (filters.charging ? 1 : 0) + filters.amenities.length
            }
          >
            <CampsiteFilterForm
              filters={filters}
              countries={countries}
              amenityCatalog={amenityCatalog}
              nameOptions={nameOptions}
            />
          </MobileFilterSheet>

          <CampsiteExplorer
            campsites={campsites}
            amenityLabels={Object.fromEntries(amenityCatalog.map((a) => [a.key, a.label_de]))}
          />
        </div>
      </div>
    </div>
  );
}
