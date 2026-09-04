import { fetchCampsiteLocationOptions, fetchCampsites, parseCampsiteFilters } from "@/lib/campsites";
import { CampsiteFilterForm } from "@/components/campsites/filter-form";
import { CampsiteExplorer } from "@/components/campsites/campsite-explorer";

export default async function CampsitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCampsiteFilters(await searchParams);
  const [campsites, { countries, regions }] = await Promise.all([
    fetchCampsites(filters),
    fetchCampsiteLocationOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Campingplätze</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        {campsites.length} Campingplätze gefunden
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <CampsiteFilterForm filters={filters} countries={countries} regions={regions} />
        </aside>

        <CampsiteExplorer campsites={campsites} />
      </div>
    </div>
  );
}
