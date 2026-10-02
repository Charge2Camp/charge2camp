import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTOR_CATEGORIES, connectorStandardMatchesAnyCategory, standardsForCategories } from "@/lib/connector-categories";
import { DEFAULT_TRAILER_VERDICTS } from "@/lib/trailer-verdict";
import type {
  CoreChargePointGeo,
  CoreConnector,
  Favorite,
  TrailerSuitabilityRecord,
  TrailerVerdict,
} from "@/types/database";

/** Nutzerwunsch: der Ladeanbieter-Filter soll ALLE tatsaechlich in der DB
 * vorkommenden Anbieter zeigen (core.charge_point.operator), nicht nur eine
 * feste Auswahl -- aber nur solche mit mindestens so vielen aktiven
 * Stationen, dass die Auswahl auch wirklich Treffer liefert (siehe
 * fetchChargingStationOperatorOptions). Ursprünglich 5 -- bei diesem
 * niedrigen Schwellwert rutschten zu viele Einzel-/Datenmüll-Eintraege
 * (Tippfehler-Varianten, Kleinstbetreiber aus dem BNetzA-Import) in die
 * Liste, was unprofessionell wirkte, statt schnell die gaengigen Anbieter
 * filtern zu lassen (Nutzerfeedback 2026-09-27). Auf 20 angehoben.*/
const MIN_STATIONS_PER_OPERATOR = 20;

/** PostgREST kodiert `.in(...)` als Query-Parameter in der URL -- bei
 * mehreren tausend IDs (siehe fetchChargingStations, bis zu 5000 Stationen)
 * wird die URL laenger als das von Cloudflare/dem Hosting erlaubte Limit
 * (lokal gegen Docker-Supabase nicht aufgefallen, dort kein CDN davor;
 * auf dem gehosteten Projekt "414 Request-URI Too Large"). Deshalb in
 * Batches abfragen statt einer einzigen riesigen IN-Liste.
 *
 * Batches laufen in begrenzt GROSSEN Gruppen parallel (BATCH_CONCURRENCY),
 * nicht mehr alle auf einmal -- bei einem weit herausgezoomten
 * Kartenausschnitt ohne bekannten Standort (Deutschland-weiter
 * Default-Ausschnitt, GERMANY_OVERVIEW_ZOOM in
 * charging-station-map-explorer.tsx) sind das bis zu 5000 IDs / 150er-Batch
 * = ~34 Batches, die enrichStations() unten ZWEIMAL (Connectoren +
 * Anhaengertauglichkeit) gleichzeitig aufruft -- macht bis zu ~68 parallele
 * DB-Anfragen. Das sprengte auf der gehosteten Instanz den Connection-Pool
 * und riss dort reihum das Postgres-Statement-Timeout ("canceling statement
 * due to statement timeout", Nutzermeldung 2026-09-30, Karte ohne Standort
 * geoeffnet -- lokal gegen Docker-Supabase mit wenigen Testdaten nicht
 * aufgefallen). Gruppen statt unbegrenzter Parallelitaet haelt die
 * Gesamtzahl gleichzeitig offener Verbindungen in einem sicheren Rahmen,
 * ohne die Batches wieder rein sequenziell (und damit spuerbar langsamer)
 * abzuarbeiten. */
const BATCH_CONCURRENCY = 8;

async function fetchInBatches<T>(
  ids: string[],
  batchSize: number,
  fetchBatch: (batchIds: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

  const rows: T[] = [];
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const group = batches.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(group.map((batch) => fetchBatch(batch)));
    for (const { data, error } of results) {
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
    }
  }
  return rows;
}

export interface ChargingStationFilters {
  q?: string;
  trailerVerdict: TrailerVerdict[];
  /** Mindest-Ladeleistung in kW, identische Stufenauswahl wie im
   * Routenplaner (0 / 50 / 150 / 300, siehe MIN_POWER_KW_OPTIONS in
   * filter-fields.tsx) -- 0 bedeutet "kein Minimum" statt `null`, damit der
   * Wert direkt als WheelPickerOption<number>-Value nutzbar ist. */
  minPowerKw: number;
  /** Schluessel aus CONNECTOR_CATEGORIES (connector-categories.ts), mehrfach
   * waehlbar -- ein Ladepunkt passt, sobald mindestens einer seiner
   * Connectoren zu MINDESTENS einer der gewaehlten Kategorien passt. */
  connectorCategories: string[];
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

/** Nutzerwunsch: "Mindest-Ladeleistung ≥150 kW" ist der Default-Zustand bei
 * einem frischen Seitenaufruf (Zielgruppe braucht auf der Reise vor allem
 * Schnelllader; identischer Default wie im Routenplaner, siehe
 * DEFAULT_MIN_POWER_KW in route-planning.ts). Filter-Chips/Wheel-Picker
 * senden im "nichts ausgewaehlt"-Zustand aber gar keinen Parameter -- ohne
 * weiteres Signal liesse sich "Nutzer war noch nie hier" (Default soll
 * gelten) nicht von "Nutzer hat bewusst 'Kein Minimum' gewaehlt und
 * abgeschickt" (Default soll NICHT gelten) unterscheiden. Das einzige
 * <form> im Filter-Panel (charging-station-map-explorer.tsx) traegt deshalb
 * IMMER ein verstecktes `filters_submitted=1`-Feld; genauso haengt
 * buildViewportQuery (selbe Datei) es bei jedem Kartenschwenk an, weil auch
 * das eine "explizite" Anfrage mit dem aktuellen Filterzustand ist. Fehlt
 * das Feld (reiner Aufruf von "/ladepunkte" ohne Query, z. B. per
 * "Zuruecksetzen"-Link), gilt der Default. */
function resolveMinPowerKw(minPowerParam: string | undefined, filtersSubmitted: boolean): number {
  if (!filtersSubmitted) return 150;
  const parsed = Number(minPowerParam);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Default-Zustand ('yes'/'unhitch') + isDefaultTrailerVerdict() liegen in
 * lib/trailer-verdict.ts -- siehe dortiger Kommentar, WARUM (next/headers-
 * Client-Bundle-Fehler bei Wert-Import von hier aus "use client"-Code). */
function resolveTrailerVerdict(selected: TrailerVerdict[], filtersSubmitted: boolean): TrailerVerdict[] {
  if (!filtersSubmitted) return DEFAULT_TRAILER_VERDICTS;
  return selected;
}

export function parseChargingStationFilters(
  searchParams: Record<string, string | string[] | undefined>
): ChargingStationFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
  // Ladeanbieter: mehrere gleichnamige Checkboxen (name="operator", ein
  // Parameter pro Auswahl), anders als trailer_${v}/connector_${key} (ein
  // Parametername PRO WERT) -- deshalb ALLE Werte fuer den Schluessel
  // noetig, nicht nur der erste (siehe get() oben).
  const getAll = (key: string): string[] => {
    const v = searchParams[key];
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  };

  const filtersSubmitted = get("filters_submitted") === "1";
  const verdicts: TrailerVerdict[] = (["yes", "unhitch", "no", "unknown"] as const).filter(
    (v) => get(`trailer_${v}`) === "1"
  );
  const connectorCategories = CONNECTOR_CATEGORIES.map((c) => c.key).filter(
    (key) => get(`connector_${key}`) === "1"
  );

  return {
    q: get("q")?.trim() || undefined,
    trailerVerdict: resolveTrailerVerdict(verdicts, filtersSubmitted),
    minPowerKw: resolveMinPowerKw(get("min_power"), filtersSubmitted),
    connectorCategories,
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

/** Filter, die nach der Anreicherung in JS laufen. `applyVerdict` nur fuer den
 * nicht-bbox-Pfad (dort liefert enrichStations alle Trailer-Zeilen inkl.
 * Platzhaltern); im bbox-Pfad filtert SQL und Platzhalter sind trailer = null. */
function applyPostFilters(
  stations: ChargingStationView[],
  filters: ChargingStationFilters,
  applyVerdict: boolean
): ChargingStationView[] {
  let results = stations;
  if (applyVerdict && filters.trailerVerdict.length > 0) {
    // 'unknown' = noch nicht bewertet (20261026160000): ein Ladepunkt OHNE
    // trailer_suitability-Zeile (trailer === null) zaehlt ebenso als 'unknown'
    // wie einer mit Platzhalter-Zeile -- identisch zu core.search_charge_points_by_verdict.
    results = results.filter((r) => filters.trailerVerdict.includes(r.trailer?.verdict ?? "unknown"));
  }
  if (filters.connectorCategories.length > 0) {
    results = results.filter((r) =>
      r.connectors.some((c) => connectorStandardMatchesAnyCategory(c.standard, filters.connectorCategories))
    );
  }
  if (filters.operators.length > 0) {
    results = results.filter((r) => r.operator !== null && filters.operators.includes(r.operator));
  }
  return results;
}

/** Alle Filter (q, Betreiber, Mindestleistung, Steckertyp, trailerVerdict)
 * greifen schon VOR der Anreicherung in SQL -- beim bbox-Pfad ueber
 * core.charge_points_in_bbox (p_trailer_verdicts), beim nicht-bbox-Pfad
 * (Server-Erstansicht ohne bekannten Kartenausschnitt) ueber
 * core.search_charge_points bzw. mit trailerVerdict ueber
 * core.search_charge_points_by_verdict (20261026100000). Die JS-Filter am
 * Ende sind nur noch eine identische Sicherheitsnetz-Pruefung.
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
 * Kartenausschnitt (Nutzerfeedback). Mit bbox greift das `limit` nur bei
 * sehr weitem Zoom (EU-Datenmenge: ein Europa-Ausschnitt enthaelt >16.000
 * Ladepunkte ab 150 kW, >120.000 ohne Leistungsfilter) -- dann liefert
 * core.charge_points_in_bbox seit 20261026140000 eine stabile, nach
 * Betreibernamen UNVERZERRTE Stichprobe (order by id statt name; die alte
 * Namenssortierung lieferte fast nur A-Betreiber) und die Route meldet
 * `truncated`, woraufhin die Karte darauf hinweist und beim Hineinzoomen
 * nachlaedt. */
export async function fetchChargingStations(
  filters: ChargingStationFilters,
  limit = 5000,
  bbox?: MapBounds
): Promise<ChargingStationView[]> {
  const supabase = createAdminClient();
  let data: CoreChargePointGeo[] | null;
  let error: { message: string } | null;

  if (bbox) {
    // core.charge_point_geo.lat/lon sind berechnete Spalten (st_y/st_x auf
    // geom) -- Zahlenvergleiche darauf koennen den GiST-Index auf geom
    // (idx_cp_geom) nicht nutzen und erzwingen einen Sequential Scan ueber
    // alle Ladepunkte bei JEDEM Kartenschwenk (gemessen: 14,9s, weit ueber
    // dem PostgREST-Statement-Timeout -- Nutzermeldung "keine Saeulen auf
    // der Karte", 2026-09-21). core.charge_points_in_bbox() filtert
    // stattdessen ueber den raeumlichen "&&"-Operator direkt auf geom (53ms,
    // siehe 20261023020000_charge_points_in_bbox_spatial_index.sql).
    // Anreicherung (Connectoren + Trailer) laeuft seit 20261026150000 in EINEM
    // Roundtrip innerhalb der Datenbank (core.charge_points_in_bbox_enriched,
    // ruft core.charge_points_in_bbox) statt ueber ~20 gebatchte Abfragen von
    // enrichStations -- siehe Migrationskommentar (Messwerte, Indizes).
    const { data: enrichedData, error: enrichedError } = await supabase
      .schema("core")
      .rpc("charge_points_in_bbox_enriched", {
      p_west: bbox.west,
      p_south: bbox.south,
      p_east: bbox.east,
      p_north: bbox.north,
      p_min_power_kw: filters.minPowerKw > 0 ? filters.minPowerKw : null,
      p_q: filters.q ?? null,
      p_limit: limit,
      // Filtert bereits VOR der Connector-/Trailer-Anreicherung (enrichStations
      // unten) auf DB-Ebene, statt erst danach in JS (siehe Filterung weiter
      // unten) -- seit dem BNetzA-Import hat der weit ueberwiegende Teil aller
      // Ladepunkte gar keinen geprueften trailer_suitability-Verdict
      // (~98,4 %, siehe DEFAULT_TRAILER_VERDICTS oben), enrichStations
      // batcht aber unabhaengig vom spaeteren JS-Filter ueber ALLE per bbox
      // gefundenen IDs (bis zu `limit`). Bei einem weit herausgezoomten
      // Kartenausschnitt (z. B. Deutschland-Erstansicht) blieb dadurch selbst
      // nach dem 20261023020000-Spatial-Index-Fix die Anreicherung teuer genug,
      // um das PostgREST-Statement-Timeout zu reissen ("Laden fehlgeschlagen",
      // Nutzermeldung nach dem BNetzA-Import). Mit dem Parameter reduziert
      // core.charge_points_in_bbox() die Treffermenge selbst schon auf die
      // ~1,6 % mit geprueftem Verdict, bevor enrichStations ueberhaupt startet.
      p_trailer_verdicts: filters.trailerVerdict.length > 0 ? filters.trailerVerdict : null,
    });
    if (enrichedError) throw new Error(enrichedError.message);
    // Verdict-Filter bewusst NICHT nochmal in JS: er greift schon in SQL, und
    // reine Platzhalter-Zeilen (unknown/auto) liefern dort trailer = null --
    // ein JS-Filter auf trailer.verdict wuerde 'unknown'-Treffer faelschlich
    // verwerfen. Connector-/Betreiber-Filter existieren in SQL fuer den bbox-
    // Pfad nicht und bleiben deshalb hier.
    return applyPostFilters((enrichedData as ChargingStationView[]) ?? [], filters, false);
  } else {
    // Performance-/Korrektheits-Audit 2026-09-30 (Nutzermeldung "canceling
    // statement due to statement timeout" auf GET /ladepunkte): q/operator/
    // min_power_kw liessen sich ueber den PostgREST-Query-Builder direkt in
    // SQL filtern, connectorCategories dagegen NICHT (core.connector haengt
    // ueber charge_point_id an core.charge_point, PostgREST kann darauf ueber
    // die VIEW core.charge_point_geo keine Embedded-Filter-Beziehung bilden)
    // -- wurde deshalb bisher ausschliesslich in JS NACH der vollen
    // Connector-/Trailer-Anreicherung gefiltert. Ohne q/trailerVerdict-
    // Selektivitaet lud dieser Zweig dadurch die ersten 5000 (alphabetisch,
    // is_active + Mindestleistung) Ladepunkte UNGEFILTERT nach Steckertyp/
    // Betreiber und reicherte sie komplett an, bevor der eigentliche Filter
    // ueberhaupt griff -- gemessen 8,7s fuer die Basisabfrage allein (EXPLAIN
    // ANALYZE gegen Produktion), plus die volle Anreicherung obendrauf.
    // core.search_charge_points() (20261025140000) filtert jetzt ALLE vier
    // nicht-bbox-Filter direkt in SQL (connectorCategories ueber ein EXISTS
    // auf core.connector, idx_conn_std) -- eine grosse ID-Liste ueber die
    // REST-API waere bei einer verbreiteten Kategorie wie "Type 2" potenziell
    // zehntausende IDs gewesen, weit jenseits sinnvoller Query-Groessen.
    // order()/limit() bewusst HIER auf das RPC-Ergebnis angewendet statt im
    // Funktionskoerper -- ein LIMIT dort verhindert, dass Postgres die
    // (an sich inlinebare) SQL-Funktion in die aufrufende Abfrage inlined,
    // was beim Connector-Filter live gemessen 8,3s statt 310ms kostete
    // (siehe Migrationskommentar 20261025140000).
    const searchParams = {
      p_q: filters.q ?? null,
      p_operators: filters.operators.length > 0 ? filters.operators : null,
      p_min_power_kw: filters.minPowerKw > 0 ? filters.minPowerKw : null,
      p_connector_standards:
        filters.connectorCategories.length > 0 ? standardsForCategories(filters.connectorCategories) : null,
    };
    if (filters.trailerVerdict.length > 0) {
      // Mit Verdict-Filter: PL/pgSQL-Funktion mit getrennten Pfaden je nach
      // Selektivitaet (nicht inlinebar) -- order/limit stecken deshalb IM
      // Funktionskoerper (p_limit), nicht per PostgREST aussen
      // (20261026100000). Ohne Verdict-Filter bleibt die inlinebare
      // search_charge_points mit order/limit von aussen.
      ({ data, error } = await supabase.schema("core").rpc("search_charge_points_by_verdict", {
        ...searchParams,
        p_trailer_verdicts: filters.trailerVerdict,
        p_limit: limit,
      }));
    } else {
      ({ data, error } = await supabase
        .schema("core")
        .rpc("search_charge_points", searchParams)
        .order("name")
        .limit(limit));
    }
  }

  if (error) throw new Error(error.message);
  const stations = (data as CoreChargePointGeo[]) ?? [];

  const results = await enrichStations(supabase, stations);
  return applyPostFilters(results, filters, true);
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

// Audit-Befund 2026-09-30 (Nutzermeldung: Absturz beim Oeffnen von
// /ladepunkte, Server-Log: "canceling statement due to statement timeout"):
// dieselbe Abfrage mit LIMIT 5000 gegen core.charge_point (inzwischen weit
// ueber 100.000 aktive Zeilen nach dem Frankreich-/Spanien-Import) braucht
// auf der gehosteten Instanz trotz Index-Nutzung (idx_cp_active_name)
// gemessen ~2,7s -- bei LIMIT 1000 dagegen nur ~10ms (nicht-lineare
// Verschlechterung ab mehreren tausend Zeilen, vermutlich Ressourcen-
// Drosselung der Instanz). Diese Liste dient nur der Vorschlagsliste im
// Suchfeld (NameSuggestField filtert client-seitig ab 3 Zeichen und zeigt
// ohnehin nur die ersten 8 Treffer) -- 1000 Namen decken das bei weitem ab,
// ohne das restliche /ladepunkte-Rendering (parallele Anfragen im selben
// Request) ins PostgREST-Statement-Timeout laufen zu lassen.
const NAME_OPTIONS_LIMIT = 1000;

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
    .limit(NAME_OPTIONS_LIMIT);
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
