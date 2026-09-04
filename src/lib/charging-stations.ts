import { createClient } from "@/lib/supabase/server";
import type { ChargingStation, TrailerSuitability } from "@/types/database";
import { TRAILER_SUITABILITY_VALUES } from "@/lib/trailer-suitability";

const FAST_CHARGER_MIN_KW = 100;

export interface ChargingStationFilters {
  q?: string;
  trailerSuitable: TrailerSuitability[];
  fastChargersOnly: boolean;
  connectorType?: string;
}

export function parseChargingStationFilters(
  searchParams: Record<string, string | string[] | undefined>
): ChargingStationFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  return {
    q: get("q")?.trim() || undefined,
    trailerSuitable: TRAILER_SUITABILITY_VALUES.filter((v) => get(`trailer_${v}`) === "1"),
    fastChargersOnly: get("fast") === "1",
    connectorType: get("connector") || undefined,
  };
}

export async function fetchChargingStations(
  filters: ChargingStationFilters
): Promise<ChargingStation[]> {
  const supabase = await createClient();
  let query = supabase.from("charging_stations").select("*");

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.trailerSuitable.length > 0) {
    query = query.in("trailer_suitable", filters.trailerSuitable);
  }
  if (filters.fastChargersOnly) query = query.gte("power_kw", FAST_CHARGER_MIN_KW);
  if (filters.connectorType) query = query.eq("connector_type", filters.connectorType);

  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return (data as ChargingStation[]) ?? [];
}

export async function fetchConnectorTypeOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("charging_stations").select("connector_type");
  if (error) throw new Error(error.message);

  const types = new Set<string>();
  for (const row of data ?? []) {
    if (row.connector_type) types.add(row.connector_type);
  }
  return Array.from(types).sort();
}
