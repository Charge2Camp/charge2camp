import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CoreChargePointGeo,
  CoreConnector,
  Favorite,
  TrailerSuitabilityRecord,
  TrailerVerdict,
} from "@/types/database";

const FAST_CHARGER_MIN_KW = 100;

/** Nutzerwunsch: der Ladeanbieter-Filter soll ALLE tatsaechlich in der DB
 * vorkommenden Anbieter zeigen (core.charge_point.operator), nicht nur eine
 * feste Auswahl -- aber nur solche mit mindestens so vielen aktiven
 * Stationen, dass die Auswahl auch wirklich Treffer liefert (siehe
 * fetchChargingStationOperatorOptions). */
const MIN_STATIONS_PER_OPERATOR = 5;

/** PostgREST kodiert `.in(...)` als Query-Parameter in der URL -- bei
 * mehreren tausend IDs (siehe fetchChargingStations, bis zu 5000 Stationen)
 * wird die URL laenger als das von Cloudflare/dem Hosting erlaubte Limit
 * (lokal gegen Docker-Supabase nicht aufgefallen, dort kein CDN davor;
 * auf dem gehosteten Projekt "414 Request-URI Too Large"). Deshalb in
 * Batches abfragen statt einer einzigen riesigen IN-Liste -- alle Batches
 * PARALLEL (nicht nacheinander), sonst summieren sich bei tausenden IDs die
 * einzelnen Round-Trips zu spuerbaren Sekunden Ladezeit (die Ladepunkte-
 * Seite laedt seit der kartenzentrierten Umstellung IMMER die volle Menge,
 * nicht mehr nur bei aktivem Filter). */
async function fetchInBatches<T>(
  ids: string[],
  batchSize: number,
  fetchBatch: (batchIds: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

  const results = await Promise.all(batches.map((batch) => fetchBatch(batch)));
  const rows: T[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}

export interface ChargingStationFilters {
  q?: string;
  trailerVerdict: TrailerVerdict[];
  fastChargersOnly: boolean;
  connectorType?: string;
  /** Exakte core.charge_point.operator-Werte (siehe
   * fetchChargingStationOperatorOptions), mehrfach waehlbar -- ein
   * Ladepunkt passt, sobald sein `operator` GENAU einem der gewaehlten
   * Werte entspricht. */
  operators: string[];
  /** Nur eigene Favoriten -- ersetzt (bei Aktivierung) alle anderen Filter,
   * siehe ladepunkte/page.tsx: eigener Fetch-Pfad ueber
   * fetchFavoriteChargingStations statt fetchChargingStations. */
  favoritesOnly: boolean;
}

/** Nutzerwunsch: "Nur Schnelllader" ist der Default-Zustand bei einem
 * frischen Seitenaufruf (Zielgruppe braucht auf der Reise vor allem
 * DC-Schnelllader). HTML-Checkboxen senden im unchecked-Zustand aber gar
 * keinen Parameter -- ohne weiteres Signal liesse sich "Nutzer war noch nie
 * hier" (Default soll gelten) nicht von "Nutzer hat bewusst abgewaehlt und
 * abgeschickt" (Default soll NICHT gelten) unterscheiden. Das einzige
 * <form> im Filter-Panel (charging-station-map-explorer.tsx) traegt deshalb
 * IMMER ein verstecktes `filters_submitted=1`-Feld; genauso haengt
 * buildViewportQuery (selbe Datei) es bei jedem Kartenschwenk an, weil auch
 * das eine "explizite" Anfrage mit dem aktuellen Filterzustand ist. Fehlt
 * das Feld (reiner Aufruf von "/ladepunkte" ohne Query, z. B. per
 * "Zuruecksetzen"-Link), gilt der Default. */
function resolveFastChargersOnly(fastParam: string | undefined, filtersSubmitted: boolean): boolean {
  if (!filtersSubmitted) return true;
  return fastParam === "1";
}

export function parseChargingStationFilters(
  searchParams: Record<string, string | string[] | undefined>
): ChargingStationFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  // Ladeanbieter: mehrere gleichnamige Checkboxen (name="operator"), anders
  // als trailer_${v}/provider_${key} vorher -- deshalb ALLE Werte fuer den
  // Schluessel noetig, nicht nur den ersten (siehe get() oben).
  const getAll = (key: string): string[] => {
    const v = searchParams[key];
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  };

  const verdicts: TrailerVerdict[] = (["yes", "unhitch", "no", "unknown"] as const).filter(
    (v) => get(`trailer_${v}`) === "1"
  );

  return {
    q: get("q")?.trim() || undefined,
    trailerVerdict: verdicts,
    fastChargersOnly: resolveFastChargersOnly(get("fast"), get("filters_submitted") === "1"),
    connectorType: get("connector") || undefined,
    operators: getAll("operator"),
    favoritesOnly: get("favorites") === "1",
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
 * Muster wie annotateChargingStops in routenplaner/actions.ts). Gemeinsam
 * fuer fetchChargingStations (Filtersuche) und fetchFavoriteChargingStations
 * (Favoriten-Liste) genutzt, damit beide dieselben Kartendaten liefern. */
async function enrichStations(
  supabase: ReturnType<typeof createAdminClient>,
  stations: CoreChargePointGeo[]
): Promise<ChargingStationView[]> {
  const ids = stations.map((s) => s.id);
  const keys = stations.map((s) => s.external_key);
  const BATCH_SIZE = 150;

  const [connectorRows, trailerRows] = await Promise.all([
    fetchInBatches<CoreConnector>(ids, BATCH_SIZE, (batch) =>
      supabase.schema("core").from("connector").select("*").in("charge_point_id", batch)
    ),
    fetchInBatches<TrailerSuitabilityRecord>(keys, BATCH_SIZE, (batch) =>
      supabase.schema("enrich").from("trailer_suitability").select("*").in("charge_point_key", batch)
    ),
  ]);

  const connectorsByChargePointId = new Map<string, CoreConnector[]>();
  for (const c of connectorRows) {
    const list = connectorsByChargePointId.get(c.charge_point_id) ?? [];
    list.push(c);
    connectorsByChargePointId.set(c.charge_point_id, list);
  }
  const trailerByKey = new Map(trailerRows.map((t) => [t.charge_point_key, t]));

  return stations.map((s) => ({
    ...s,
    connectors: connectorsByChargePointId.get(s.id) ?? [],
    trailer: trailerByKey.get(s.external_key) ?? null,
  }));
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** trailerVerdict/connectorType filtern erst NACH dem Laden (in JS) statt
 * in der SQL-Abfrage -- fuer den MVP-Datenumfang ausreichend.
 * `limit` bewusst ueberschreibbar: die kartenzentrierte Ladepunkte-Seite
 * laedt ohne aktiven Filter (Karten-Erstueberblick) eine kleinere Menge als
 * bei gezielter Filterung (siehe ladepunkte/page.tsx) -- ueber 18.000 echte
 * Ladepunkte insgesamt waeren ungefiltert sonst spuerbar langsam.
 *
 * `bbox` grenzt VOR dem `order("name").limit(limit)` geografisch ein (§
 * charging-station-map-explorer.tsx: die Karte laedt Ladepunkte
 * kartenausschnitt-basiert nach). Ohne bbox sortiert die vorherige Version
 * dieser Funktion rein alphabetisch nach Name und schneidet danach ab --
 * bei ueber 18.000 Ladepunkten blieben dadurch alle Namen ab ungefaehr "S"
 * bis "Z" fuer das reine Kartenbrowsen unsichtbar, unabhaengig vom
 * Kartenausschnitt (Nutzerfeedback). Mit bbox ist die Alphabet-Sortierung
 * dagegen unproblematisch, da `limit` innerhalb eines Kartenausschnitts in
 * der Praxis so gut wie nie erreicht wird. */
export async function fetchChargingStations(
  filters: ChargingStationFilters,
  limit = 5000,
  bbox?: MapBounds
): Promise<ChargingStationView[]> {
  const supabase = createAdminClient();
  let query = supabase.schema("core").from("charge_point_geo").select("*");

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.fastChargersOnly) query = query.gte("max_power_kw", FAST_CHARGER_MIN_KW);
  if (bbox) {
    query = query
      .gte("lat", bbox.south)
      .lte("lat", bbox.north)
      .gte("lon", bbox.west)
      .lte("lon", bbox.east);
  }

  const { data, error } = await query.order("name").limit(limit);
  if (error) throw new Error(error.message);
  const stations = (data as CoreChargePointGeo[]) ?? [];

  let results = await enrichStations(supabase, stations);

  if (filters.trailerVerdict.length > 0) {
    results = results.filter((r) => r.trailer && filters.trailerVerdict.includes(r.trailer.verdict));
  }
  if (filters.connectorType) {
    results = results.filter((r) => r.connectors.some((c) => c.standard === filters.connectorType));
  }
  if (filters.operators.length > 0) {
    results = results.filter((r) => r.operator !== null && filters.operators.includes(r.operator));
  }
  return results;
}

/** Vom Nutzer gemerkte Ladepunkte mit vollen Kartendaten (core.charge_point_geo
 * + Connectoren + Anhaengertauglichkeit) -- gezeigt statt der ungefilterten
 * Gesamtliste, solange keine Filter aktiv sind (siehe ladepunkte/page.tsx,
 * gleiches Muster wie fetchFavoriteCampsites in lib/campsites.ts). Nicht
 * angemeldet oder noch keine Favoriten gemerkt: leere Liste, kein Fehler. */
export async function fetchFavoriteChargingStations(userId: string): Promise<ChargingStationView[]> {
  const supabase = await createClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", "charging_station");
  const stationIds = ((favorites as Favorite[]) ?? []).map((f) => f.entity_id);
  if (stationIds.length === 0) return [];

  const adminClient = createAdminClient();
  const { data, error } = await adminClient.schema("core").from("charge_point_geo").select("*").in("id", stationIds);
  if (error) throw new Error(error.message);
  return enrichStations(adminClient, (data as CoreChargePointGeo[]) ?? []);
}

/** Anzeigename je Ladepunkt (Name, falls vorhanden, sonst Betreiber),
 * unabhaengig von aktiven Filtern, fuer die Vorschlagsliste im Suchfeld. */
export async function fetchChargingStationNameOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("charge_point")
    .select("name, operator")
    .eq("is_active", true)
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  const labels = (data ?? []).map((row) => row.name ?? row.operator).filter(Boolean);
  return Array.from(new Set(labels));
}

export interface ChargingStationOperatorOption {
  operator: string;
  stationCount: number;
}

/** Alle core.charge_point.operator-Werte mit mindestens
 * MIN_STATIONS_PER_OPERATOR aktiven Stationen, fuer die Checkbox-Auswahl im
 * Ladeanbieter-Filter (Nutzerwunsch: "alle Anbieter aus der Datenbank ...
 * mit mindestens fuenf auffindbaren Stationen" statt einer festen Liste).
 * Ueber 18.000 core.charge_point-Zeilen client-/JS-seitig zu gruppieren
 * wuerde entweder am PostgREST-max_rows-Limit (5000) scheitern oder viele
 * paginierte Requests bei JEDEM Seitenaufruf brauchen -- die Aggregation
 * laeuft deshalb als SQL-Funktion direkt in Postgres (core.
 * charge_point_operator_options, siehe
 * 20261006000000_charge_point_operator_options.sql), analog zu
 * core.charge_point_filter_options() im Admin-Bereich. */
export async function fetchChargingStationOperatorOptions(): Promise<ChargingStationOperatorOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .rpc("charge_point_operator_options", { p_min_stations: MIN_STATIONS_PER_OPERATOR });
  if (error) throw new Error(error.message);
  return ((data as { operator: string; station_count: number }[]) ?? []).map((row) => ({
    operator: row.operator,
    stationCount: row.station_count,
  }));
}

export async function fetchConnectorTypeOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("core").from("connector").select("standard").limit(5000);
  if (error) throw new Error(error.message);

  const types = new Set<string>();
  for (const row of data ?? []) {
    if (row.standard) types.add(row.standard);
  }
  return Array.from(types).sort();
}
