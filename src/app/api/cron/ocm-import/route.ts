import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wiederkehrender Open-Charge-Map-Reimport (Nutzerwunsch: "in welchem
 * Zyklus gelangen neu gelistete Saeulen in meine Plattform" -- bisher gar
 * nicht automatisch, siehe ingest/import_ocm.py, das bislang nur von Hand
 * angestossen wurde). Per Vercel Cron taeglich ausgeloest (vercel.json),
 * importiert JE LAUF EIN Land aus CORE_COUNTRIES (Wochentag-Rotation,
 * siehe pickCountryForToday) -- ein voller Zyklus ueber alle Kernlaender
 * dauert damit eine Woche. Bewusst NICHT alle Laender in einem Lauf: bei
 * grossen Laendern (DE: ~25.000 Ladepunkte) wuerde das Serverless-
 * Zeitlimit selbst mit Bulk-Upserts eng, siehe maxDuration unten.
 *
 * Portiert dieselbe Kernlogik wie ingest/import_ocm.py (Steckertyp-Mapping,
 * Ableitung von max_power_kw/connector_count aus den Anschluessen) nach
 * TypeScript, weil das Python-Skript direkt per psycopg2 verbindet (kein
 * DB-Passwort im Deploy verfuegbar/gewuenscht) -- dieser Weg laeuft
 * stattdessen ueber den Service-Role-Client (PostgREST), analog zum
 * Admin-Backend. raw.charge_point-Zwischenspeicherung (Rohdaten-Cache)
 * entfaellt hier bewusst -- das raw-Schema ist nicht ueber PostgREST
 * erreichbar (supabase/config.toml [api] schemas), nur core/enrich.
 */

// Vercel-Plan dieses Projekts ist Hobby (siehe VERCEL_OIDC_TOKEN-Claim
// "plan":"hobby" in .env.local) -- 60s ist dort das Maximum fuer
// maxDuration. Grosse Laender (v. a. DE, ~25.000 Ladepunkte) koennen trotz
// Bulk-Upserts laenger brauchen als das erlaubt; das Ergebnis-JSON zeigt
// dann einen Timeout/Abbruch, der naechste taegliche Lauf (gleiches Land,
// da die Wochentag-Rotation erst am naechsten Wochentag weiterschaltet)
// wuerde die fehlenden Datensaetze nachholen (Upsert ist idempotent). Bei
// einem Upgrade auf Pro kann dieser Wert auf bis zu 300 erhoeht werden.
export const maxDuration = 60;

const CORE_COUNTRIES = ["DE", "FR", "IT", "NL", "AT", "BE", "CH"] as const;

const CONNECTION_TYPE_MAP: Record<number, { standard: string; currentType: "AC" | "DC" }> = {
  1: { standard: "Type1", currentType: "AC" },
  2: { standard: "CHAdeMO", currentType: "DC" },
  25: { standard: "Type2", currentType: "AC" },
  28: { standard: "Schuko", currentType: "AC" },
  32: { standard: "CCS1", currentType: "DC" },
  33: { standard: "CCS2", currentType: "DC" },
  1036: { standard: "Type2_Socket", currentType: "AC" },
};
const CURRENT_TYPE_BY_ID: Record<number, "AC" | "DC"> = { 10: "AC", 20: "AC", 30: "DC" };

function pickCountryForToday(date = new Date()): (typeof CORE_COUNTRIES)[number] {
  return CORE_COUNTRIES[date.getUTCDay() % CORE_COUNTRIES.length];
}

interface OcmConnection {
  ConnectionType?: { ID?: number; Title?: string } | null;
  ConnectionTypeID?: number;
  PowerKW?: number | null;
  CurrentTypeID?: number;
  Quantity?: number | null;
}

interface OcmPoi {
  ID?: number;
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    AddressLine2?: string;
    Town?: string;
    Postcode?: string;
    Latitude?: number;
    Longitude?: number;
    Country?: { ISOCode?: string } | null;
  } | null;
  OperatorInfo?: { Title?: string } | null;
  UsageType?: { Title?: string } | null;
  StatusType?: { IsOperational?: boolean | null } | null;
  DateLastStatusUpdate?: string | null;
  Connections?: OcmConnection[] | null;
}

interface ParsedConnector {
  standard: string;
  power_kw: number | null;
  current_type: "AC" | "DC" | null;
  quantity: number;
}

interface ParsedChargePoint {
  external_key: string;
  name: string | null;
  operator: string | null;
  network: string | null;
  geom: string;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country_code: string | null;
  access_type: string | null;
  is_operational: boolean;
  max_power_kw: number | null;
  connector_count: number | null;
  source: "ocm";
  source_updated_at: string | null;
  connectors: ParsedConnector[];
}

function parseConnection(raw: OcmConnection): ParsedConnector {
  const typeId = raw.ConnectionType?.ID ?? raw.ConnectionTypeID;
  const mapped = typeId !== undefined ? CONNECTION_TYPE_MAP[typeId] : undefined;
  const standard = mapped?.standard ?? raw.ConnectionType?.Title ?? (typeId !== undefined ? `unknown:${typeId}` : "unknown");
  const currentType = mapped?.currentType ?? (raw.CurrentTypeID !== undefined ? CURRENT_TYPE_BY_ID[raw.CurrentTypeID] ?? null : null);
  return {
    standard,
    power_kw: raw.PowerKW ?? null,
    current_type: currentType,
    quantity: raw.Quantity ?? 1,
  };
}

function parsePoi(poi: OcmPoi): ParsedChargePoint | null {
  const address = poi.AddressInfo;
  const lat = address?.Latitude;
  const lon = address?.Longitude;
  if (poi.ID === undefined || lat === undefined || lon === undefined) return null;

  const usageTitle = poi.UsageType?.Title?.toLowerCase() ?? "";
  const accessType = usageTitle.includes("private") ? "private" : usageTitle.includes("restricted") ? "restricted" : poi.UsageType ? "public" : null;

  const isOperational = poi.StatusType?.IsOperational ?? true;
  const connections = poi.Connections ?? [];
  const connectors = connections.map(parseConnection);
  const powerValues = connectors.map((c) => c.power_kw).filter((v): v is number => v !== null);
  const maxPowerKw = powerValues.length > 0 ? Math.max(...powerValues) : null;
  const connectorCount = connectors.reduce((sum, c) => sum + c.quantity, 0);

  const addressLine = [address?.AddressLine1, address?.AddressLine2].filter(Boolean).join(", ");

  return {
    external_key: `ocm:${poi.ID}`,
    name: address?.Title ?? null,
    operator: poi.OperatorInfo?.Title ?? null,
    network: poi.OperatorInfo?.Title ?? null,
    geom: `SRID=4326;POINT(${lon} ${lat})`,
    address: addressLine || null,
    postcode: address?.Postcode ?? null,
    city: address?.Town ?? null,
    country_code: address?.Country?.ISOCode ?? null,
    access_type: accessType,
    is_operational: isOperational,
    max_power_kw: maxPowerKw,
    connector_count: connectorCount || null,
    source: "ocm",
    source_updated_at: poi.DateLastStatusUpdate ?? null,
    connectors,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const apiKey = process.env.OPEN_CHARGE_MAP_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPEN_CHARGE_MAP_API_KEY fehlt." }, { status: 500 });

  const countryParam = request.nextUrl.searchParams.get("country");
  const country = (countryParam && CORE_COUNTRIES.includes(countryParam as (typeof CORE_COUNTRIES)[number])
    ? countryParam
    : pickCountryForToday()) as (typeof CORE_COUNTRIES)[number];

  const supabase = createAdminClient();

  // Lauf wird SOFORT (vor der eigentlichen Arbeit) als 'running' protokolliert,
  // nicht erst am Ende bei Erfolg -- sonst hinterlaesst ein harter Vercel-
  // Timeout (60s auf dem Hobby-Plan, siehe maxDuration oben; grosse Laender
  // wie DE/FR koennen das ueberschreiten) GAR KEINEN Eintrag: der Prozess
  // wird beim Timeout abrupt gekillt, kein Code danach kann mehr laufen,
  // auch kein try/catch faengt das ab. Ein haengender 'running'-Lauf ist
  // im Dashboard/core.last_ocm_import() trotzdem sichtbar (sortiert nach
  // started_at, nicht nach Status) statt komplett zu verschwinden (Audit-
  // Befund 2026-09-22: 3 Tage ohne jeden Eintrag trotz taeglichem Cron).
  const { data: runId, error: startRunError } = await supabase.schema("core").rpc("start_import_run", {
    p_source: "ocm",
    p_scope: `country:${country}`,
  });
  if (startRunError) {
    return NextResponse.json({ error: `start_import_run: ${startRunError.message}`, country }, { status: 500 });
  }

  async function fail(message: string, status: number, partialCount = 0) {
    await supabase.schema("core").rpc("finish_import_run", {
      p_run_id: runId,
      p_status: "error",
      p_record_count: partialCount,
      p_notes: message,
    });
    return NextResponse.json({ error: message, country }, { status });
  }

  const ocmUrl = new URL("https://api.openchargemap.io/v3/poi");
  ocmUrl.searchParams.set("key", apiKey);
  ocmUrl.searchParams.set("countrycode", country);
  ocmUrl.searchParams.set("maxresults", "100000");
  ocmUrl.searchParams.set("compact", "false");
  ocmUrl.searchParams.set("includecomments", "false");

  const ocmResponse = await fetch(ocmUrl, { signal: AbortSignal.timeout(120_000) });
  if (!ocmResponse.ok) {
    return fail(`OCM-API-Fehler: ${ocmResponse.status}`, 502);
  }
  const pois = (await ocmResponse.json()) as OcmPoi[];

  const parsed = pois.map(parsePoi).filter((p): p is ParsedChargePoint => p !== null);

  // Schreibt ueber core.upsert_charge_point() (siehe supabase/migrations/
  // 20261012000000_field_provenance_and_source_registry.sql) statt eines
  // rohen PostgREST-.upsert(): Letzteres schrieb bedingungslos alle Spalten
  // und ignorierte damit core.charge_point.manual_override komplett -- eine
  // Admin-Korrektur (z. B. Betreiber) wurde vom taeglichen Cron trotzdem
  // ueberschrieben, obwohl ingest/import_ocm.py (manueller Lauf) denselben
  // Fall bereits korrekt schuetzte. Die RPC ist jetzt der EINZIGE Merge-Pfad
  // fuer core.charge_point, in Python wie in TS.
  let coreUpserted = 0;
  const idByKey = new Map<string, string>();
  const manualOverrideByKey = new Map<string, boolean>();
  for (const batch of chunk(parsed, 300)) {
    const payloads = batch.map((p) => {
      const { geom, ...rest } = p;
      const match = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(geom);
      const lon = match ? Number(match[1]) : null;
      const lat = match ? Number(match[2]) : null;
      return { ...rest, lon, lat };
    });
    const { data, error } = await supabase.schema("core").rpc("upsert_charge_points_bulk", {
      p_payloads: payloads,
      p_source: "ocm",
    });
    if (error) return fail(`charge_point upsert: ${error.message}`, 500, coreUpserted);
    for (const row of (data ?? []) as { external_key: string; id: string; manual_override: boolean }[]) {
      idByKey.set(row.external_key, row.id);
      manualOverrideByKey.set(row.external_key, row.manual_override);
    }
    coreUpserted += batch.length;
  }

  // Kleinere Batches als bei den anderen .in()-Aufrufen: UUIDs sind laenger
  // als external_keys, ein zu grosser Batch sprengt sonst die maximale
  // URI-Laenge (PostgREST kodiert Filter als Query-Parameter). Bei
  // manual_override=true bleiben die Anschluesse unangetastet -- gleiches
  // Prinzip wie replace_connectors() in ingest/import_ocm.py.
  const chargePointIds = Array.from(idByKey.entries())
    .filter(([key]) => !manualOverrideByKey.get(key))
    .map(([, id]) => id);
  for (const batch of chunk(chargePointIds, 100)) {
    const { error } = await supabase.schema("core").from("connector").delete().in("charge_point_id", batch);
    if (error) return fail(`connector delete: ${error.message}`, 500, coreUpserted);
  }

  const connectorRows = parsed.flatMap((p) => {
    if (manualOverrideByKey.get(p.external_key)) return [];
    const chargePointId = idByKey.get(p.external_key);
    if (!chargePointId) return [];
    return p.connectors.map((c) => ({ charge_point_id: chargePointId, standard: c.standard, power_kw: c.power_kw, current_type: c.current_type, quantity: c.quantity }));
  });
  let connectorsInserted = 0;
  for (const batch of chunk(connectorRows, 500)) {
    const { error } = await supabase.schema("core").from("connector").insert(batch);
    if (error) return fail(`connector insert: ${error.message}`, 500, coreUpserted);
    connectorsInserted += batch.length;
  }

  const { data: deactivatedCount, error: dedupError } = await supabase.schema("core").rpc("deactivate_new_ocm_near_manual");
  if (dedupError) return fail(`dedup: ${dedupError.message}`, 500, coreUpserted);

  const { error: fillError } = await supabase.schema("core").rpc("fill_missing_trailer_suitability");
  if (fillError) return fail(`fill_missing_trailer_suitability: ${fillError.message}`, 500, coreUpserted);

  await supabase.schema("core").rpc("finish_import_run", {
    p_run_id: runId,
    p_status: "ok",
    p_record_count: coreUpserted,
    p_notes: "vercel-cron",
  });

  return NextResponse.json({
    country,
    fetched: pois.length,
    parsed: parsed.length,
    coreUpserted,
    connectorsInserted,
    deactivatedNearManual: deactivatedCount,
  });
}
