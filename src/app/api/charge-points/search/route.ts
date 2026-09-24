import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiUser } from "@/lib/api-guard";
import type { CoreChargePointGeo, CoreConnector, TrailerSuitabilityRecord, TrailerVerdict } from "@/types/database";

/**
 * Auftrag D -- GET /api/charge-points/search, "analog" zu
 * /api/campsites/search laut Spec (bbox, near+radius_km, min_power_kw,
 * connector, trailer, operator). Anders als bei Campingplaetzen gibt es
 * fuer Ladepunkte noch keinen Meilisearch-Index (Auftrag E deckt nur
 * core.campsite_search ab) -- deshalb direkt gegen core.charge_point_geo /
 * core.connector / enrich.trailer_suitability, in derselben Weise wie
 * src/lib/charging-stations.ts fuer die Ladepunkte-Uebersichtsseite.
 * Keine Facetten-Trefferzaehler hier (nur Meilisearch liefert die guenstig,
 * siehe /api/campsites/search) -- fuer den MVP-Datenumfang reicht das.
 */

const MAX_LIMIT = 100;
const FAST_CHARGER_TRAILER_YES = "yes";

export async function GET(request: NextRequest) {
  // Sicherheits-Audit: Login + Rate-Limit Pflicht (dieser Endpunkt war
  // bisher komplett oeffentlich und lieferte den vollen Datensatz inkl.
  // Anhaengertauglichkeit ohne jede Authentifizierung).
  const guard = await requireApiUser("charge-points-search", { windowSeconds: 60, maxRequests: 60 });
  if ("response" in guard) return guard.response;

  const sp = request.nextUrl.searchParams;
  const supabase = createAdminClient();

  const bbox = sp.get("bbox");
  const near = sp.get("near");
  const radiusKm = sp.get("radius_km");
  let nearPoint: { lat: number; lon: number; radius: number } | null = null;
  // West/Sued/Ost/Nord-Grenzen, sobald bbox ODER near+radius_km angegeben
  // sind -- beide Faelle laufen unten ueber dieselbe RPC (siehe bounds).
  let bounds: { west: number; south: number; east: number; north: number } | null = null;

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      return NextResponse.json({ error: "bbox muss 'minLon,minLat,maxLon,maxLat' sein." }, { status: 400 });
    }
    const [minLon, minLat, maxLon, maxLat] = parts;
    bounds = { west: minLon, south: minLat, east: maxLon, north: maxLat };
  } else if (near && radiusKm) {
    const [lat, lon] = near.split(",").map(Number);
    const radius = Number(radiusKm);
    if ([lat, lon, radius].some((n) => Number.isNaN(n))) {
      return NextResponse.json({ error: "near muss 'lat,lon' sein, radius_km eine Zahl." }, { status: 400 });
    }
    nearPoint = { lat, lon, radius };
    // Grobe Bounding-Box aus near+radius_km als DB-seitiger Vorfilter, die
    // anschliessende Haversine-Filterung unten grenzt sie auf den exakten
    // Kreis ein. Grad->km: 1 deg lat ~= 111 km.
    const latDelta = radius / 111;
    const lonDelta = radius / (111 * Math.cos((lat * Math.PI) / 180) || 1);
    bounds = { west: lon - lonDelta, south: lat - latDelta, east: lon + lonDelta, north: lat + latDelta };
  }

  const minPowerKw = sp.get("min_power_kw");
  const trailer = sp.get("trailer");
  // Push-down fuer den bounds-Pfad (core.charge_points_in_bbox, siehe unten)
  // -- reduziert die Kandidatenmenge VOR limit(2000) statt erst danach in
  // JS (Filterung weiter unten bleibt zusaetzlich bestehen, u. a. fuer den
  // Pfad ohne bounds).
  const trailerVerdictsForSql =
    trailer === "yes_or_unhitch" ? ["yes", "unhitch"] : trailer === FAST_CHARGER_TRAILER_YES ? ["yes"] : null;

  const limit = Math.min(Number(sp.get("limit") ?? "24") || 24, MAX_LIMIT);
  const offset = Number(sp.get("offset") ?? "0") || 0;

  let stations: CoreChargePointGeo[];
  if (bounds) {
    // core.charge_point_geo.lat/lon sind berechnete Spalten -- Zahlen-
    // vergleiche darauf (wie vorher hier: .gte("lat", ...) usw.) koennen den
    // GiST-Index auf geom (idx_cp_geom) nicht nutzen und erzwingen einen
    // Sequential Scan ueber alle ~234.000 Ladepunkte bei JEDER bbox/near-
    // Anfrage -- exakt der Bug, der fuer die Ladepunkte-Karte bereits in
    // core.charge_points_in_bbox() behoben wurde (siehe
    // 20261023020000_charge_points_in_bbox_spatial_index.sql,
    // src/lib/charging-stations.ts). Dieser Endpunkt nutzte bislang aber
    // noch die alte, langsame Variante -- jetzt dieselbe RPC wie die Karte.
    const { data, error } = await supabase.schema("core").rpc("charge_points_in_bbox", {
      p_west: bounds.west,
      p_south: bounds.south,
      p_east: bounds.east,
      p_north: bounds.north,
      p_min_power_kw: minPowerKw ? Number(minPowerKw) : null,
      p_q: null,
      p_limit: 2000,
      p_trailer_verdicts: trailerVerdictsForSql,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    stations = (data as CoreChargePointGeo[]) ?? [];
  } else {
    let query = supabase.schema("core").from("charge_point_geo").select("*");
    if (minPowerKw) query = query.gte("max_power_kw", Number(minPowerKw));
    const { data, error } = await query.order("name").limit(2000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    stations = (data as CoreChargePointGeo[]) ?? [];
  }

  const operator = sp.get("operator");
  if (operator) {
    const needle = operator.toLowerCase();
    stations = stations.filter((s) => s.operator?.toLowerCase().includes(needle));
  }

  if (nearPoint) {
    stations = stations.filter((s) => haversineKm(nearPoint.lat, nearPoint.lon, s.lat, s.lon) <= nearPoint.radius);
  }

  // Connector-/Anhaengertauglichkeits-Filter brauchen Zusatzdaten aus
  // anderen Tabellen -- deshalb erst fuer die GESAMTE geo-/leistungs-
  // gefilterte Kandidatenmenge laden und filtern, dann erst paginieren
  // (sonst wuerden Treffer aus einer spaeteren Seite faelschlich fehlen).
  const candidateIds = stations.map((s) => s.id);
  const candidateKeys = stations.map((s) => s.external_key);
  const [{ data: connectorRows }, { data: trailerRows }] = await Promise.all([
    candidateIds.length > 0
      ? supabase.schema("core").from("connector").select("*").in("charge_point_id", candidateIds)
      : Promise.resolve({ data: [] as CoreConnector[] }),
    candidateKeys.length > 0
      ? supabase.schema("enrich").from("trailer_suitability").select("*").in("charge_point_key", candidateKeys)
      : Promise.resolve({ data: [] as TrailerSuitabilityRecord[] }),
  ]);

  const connectorsByChargePointId = new Map<string, CoreConnector[]>();
  for (const c of (connectorRows as CoreConnector[]) ?? []) {
    const list = connectorsByChargePointId.get(c.charge_point_id) ?? [];
    list.push(c);
    connectorsByChargePointId.set(c.charge_point_id, list);
  }
  const trailerByKey = new Map(
    ((trailerRows as TrailerSuitabilityRecord[]) ?? []).map((t) => [t.charge_point_key, t])
  );

  const connector = sp.get("connector");
  if (connector) {
    stations = stations.filter((s) => (connectorsByChargePointId.get(s.id) ?? []).some((c) => c.standard === connector));
  }

  if (trailer === "yes_or_unhitch") {
    stations = stations.filter((s) => {
      const verdict = trailerByKey.get(s.external_key)?.verdict;
      return verdict === "yes" || verdict === "unhitch";
    });
  } else if (trailer === FAST_CHARGER_TRAILER_YES) {
    stations = stations.filter((s) => trailerByKey.get(s.external_key)?.verdict === "yes");
  }

  const total = stations.length;
  stations = stations.slice(offset, offset + limit);

  return NextResponse.json({
    total,
    items: stations.map((s) => ({
      external_key: s.external_key,
      name: s.name,
      operator: s.operator,
      lat: s.lat,
      lon: s.lon,
      max_power_kw: s.max_power_kw,
      is_operational: s.is_operational,
      connectors: connectorsByChargePointId.get(s.id) ?? [],
      trailer: trailerByKey.get(s.external_key)
        ? { verdict: trailerByKey.get(s.external_key)?.verdict as TrailerVerdict }
        : { verdict: "unknown" as TrailerVerdict },
    })),
    attribution: ["Ladepunkte: Open Charge Map"],
  });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
