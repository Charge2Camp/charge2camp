import { createClient } from "@/lib/supabase/server";
import type { CoreChargePointGeo, CoreConnector, TrailerSuitabilityRecord, TrailerVerdict } from "@/types/database";

const FAST_CHARGER_MIN_KW = 100;

export interface ChargingStationFilters {
  q?: string;
  trailerVerdict: TrailerVerdict[];
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

  const verdicts: TrailerVerdict[] = (["yes", "unhitch", "no", "unknown"] as const).filter(
    (v) => get(`trailer_${v}`) === "1"
  );

  return {
    q: get("q")?.trim() || undefined,
    trailerVerdict: verdicts,
    fastChargersOnly: get("fast") === "1",
    connectorType: get("connector") || undefined,
  };
}

export interface ChargingStationView extends CoreChargePointGeo {
  connectors: CoreConnector[];
  trailer: TrailerSuitabilityRecord | null;
}

/** core.connector und enrich.trailer_suitability haengen nur ueber IDs/
 * Textschluessel zusammen, nicht ueber eine PostgREST-embedbare FK-
 * Beziehung durch die core.charge_point_geo-VIEW -- deshalb zwei
 * Zusatzabfragen statt eines Embeds, im Code zusammengefuehrt (gleiches
 * Muster wie annotateChargingStops in routenplaner/actions.ts).
 * trailerVerdict/connectorType filtern deshalb erst NACH dem Laden (in JS)
 * statt in der SQL-Abfrage -- fuer den MVP-Datenumfang ausreichend. */
export async function fetchChargingStations(filters: ChargingStationFilters): Promise<ChargingStationView[]> {
  const supabase = await createClient();
  let query = supabase.schema("core").from("charge_point_geo").select("*");

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.fastChargersOnly) query = query.gte("max_power_kw", FAST_CHARGER_MIN_KW);

  const { data, error } = await query.order("name").limit(5000);
  if (error) throw new Error(error.message);
  const stations = (data as CoreChargePointGeo[]) ?? [];

  const ids = stations.map((s) => s.id);
  const keys = stations.map((s) => s.external_key);

  const [{ data: connectorRows, error: connectorError }, { data: trailerRows, error: trailerError }] =
    await Promise.all([
      ids.length > 0
        ? supabase.schema("core").from("connector").select("*").in("charge_point_id", ids)
        : Promise.resolve({ data: [] as CoreConnector[], error: null }),
      keys.length > 0
        ? supabase.schema("enrich").from("trailer_suitability").select("*").in("charge_point_key", keys)
        : Promise.resolve({ data: [] as TrailerSuitabilityRecord[], error: null }),
    ]);
  if (connectorError) throw new Error(connectorError.message);
  if (trailerError) throw new Error(trailerError.message);

  const connectorsByChargePointId = new Map<string, CoreConnector[]>();
  for (const c of (connectorRows as CoreConnector[]) ?? []) {
    const list = connectorsByChargePointId.get(c.charge_point_id) ?? [];
    list.push(c);
    connectorsByChargePointId.set(c.charge_point_id, list);
  }
  const trailerByKey = new Map(
    ((trailerRows as TrailerSuitabilityRecord[]) ?? []).map((t) => [t.charge_point_key, t])
  );

  let results: ChargingStationView[] = stations.map((s) => ({
    ...s,
    connectors: connectorsByChargePointId.get(s.id) ?? [],
    trailer: trailerByKey.get(s.external_key) ?? null,
  }));

  if (filters.trailerVerdict.length > 0) {
    results = results.filter((r) => r.trailer && filters.trailerVerdict.includes(r.trailer.verdict));
  }
  if (filters.connectorType) {
    results = results.filter((r) => r.connectors.some((c) => c.standard === filters.connectorType));
  }
  return results;
}

/** Anzeigename je Ladepunkt (Name, falls vorhanden, sonst Betreiber),
 * unabhaengig von aktiven Filtern, fuer die Vorschlagsliste im Suchfeld. */
export async function fetchChargingStationNameOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("charge_point")
    .select("name, operator")
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  const labels = (data ?? []).map((row) => row.name ?? row.operator).filter(Boolean);
  return Array.from(new Set(labels));
}

export async function fetchConnectorTypeOptions(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("core").from("connector").select("standard").limit(5000);
  if (error) throw new Error(error.message);

  const types = new Set<string>();
  for (const row of data ?? []) {
    if (row.standard) types.add(row.standard);
  }
  return Array.from(types).sort();
}
