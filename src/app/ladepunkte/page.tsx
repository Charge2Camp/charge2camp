import {
  fetchChargingStations,
  fetchConnectorTypeOptions,
  parseChargingStationFilters,
} from "@/lib/charging-stations";
import { ChargingStationFilterForm } from "@/components/charging-stations/filter-form";
import { ChargingStationExplorer } from "@/components/charging-stations/charging-station-explorer";

export default async function ChargingStationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseChargingStationFilters(await searchParams);
  const [stations, connectorTypes] = await Promise.all([
    fetchChargingStations(filters),
    fetchConnectorTypeOptions(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Ladepunkte</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        {stations.length} Ladepunkte gefunden
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ChargingStationFilterForm filters={filters} connectorTypes={connectorTypes} />
        </aside>

        <ChargingStationExplorer stations={stations} />
      </div>
    </div>
  );
}
