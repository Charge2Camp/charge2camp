import { NextRequest, NextResponse } from "next/server";
import { searchIndex } from "@/lib/search/meilisearch";
import type { CampsiteSearchRow } from "@/types/database";

/**
 * Auftrag D -- GET /api/campsites/search (siehe CLAUDE_CODE_AUFTRAG.md
 * Abschnitt 9). Statt FastAPI (Spec-Annahme) als Next.js Route Handler,
 * per Nutzerentscheidung. Liest aus dem Meilisearch-Index 'campsites'
 * (Auftrag E, ingest/index_meilisearch.py) statt direkt aus Postgres --
 * die Facetten-Trefferzaehler kommen deshalb ohne teure eigene
 * COUNT-Abfragen.
 *
 * Bekannte Einschraenkungen (bewusst, siehe Kommentare unten statt
 * stillschweigend falsche Ergebnisse zu liefern):
 * - `connector` ist fuer Campingplaetze nicht filterbar -- der Suchindex
 *   kennt nur aggregierte Ladeinfos (naechste Leistung/Distanz), keine
 *   Steckertypen einzelner Ladepunkte. Fuer Ladepunkt-Suche siehe
 *   /api/charge-points/search.
 * - `trailer=yes_or_unhitch` ist nicht unterstuetzt -- core.campsite_search
 *   berechnet nur die Distanz zum naechsten 'yes'-Ladepunkt, nicht
 *   zusaetzlich zum naechsten 'unhitch'-Ladepunkt.
 */

const MAX_LIMIT = 100;

function buildBboxFilter(bbox: string): string {
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error("bbox muss 'minLon,minLat,maxLon,maxLat' sein.");
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  return `_geoBoundingBox([${maxLat}, ${minLon}], [${minLat}, ${maxLon}])`;
}

function buildNearFilter(near: string, radiusKm: string): string {
  const [lat, lon] = near.split(",").map(Number);
  const radius = Number(radiusKm);
  if ([lat, lon, radius].some((n) => Number.isNaN(n))) {
    throw new Error("near muss 'lat,lon' sein, radius_km eine Zahl.");
  }
  return `_geoRadius(${lat}, ${lon}, ${radius * 1000})`;
}

function chargingFilter(value: string): string | null {
  switch (value) {
    case "on_site":
      return "charging_on_site = true";
    case "walking":
      return "nearest_walk_m IS NOT NULL";
    case "any":
      return "(charging_on_site = true OR nearest_walk_m IS NOT NULL)";
    case "none":
      return "(charging_on_site = false AND nearest_walk_m IS NULL)";
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const q = sp.get("q") ?? "";
  const filters: string[] = [];

  try {
    const bbox = sp.get("bbox");
    if (bbox) filters.push(buildBboxFilter(bbox));

    const near = sp.get("near");
    const radiusKm = sp.get("radius_km");
    if (near && radiusKm) filters.push(buildNearFilter(near, radiusKm));

    const countries = sp.getAll("country");
    if (countries.length > 0) {
      filters.push(`country_code IN [${countries.map((c) => `"${c}"`).join(", ")}]`);
    }

    const amenities = sp.get("amenities");
    if (amenities) {
      for (const key of amenities.split(",").map((s) => s.trim()).filter(Boolean)) {
        filters.push(`amenities = "${key}"`);
      }
    }

    const charging = sp.get("charging");
    const chargingBase = charging ? chargingFilter(charging) : null;
    if (charging && !chargingBase) {
      return NextResponse.json({ error: `Ungueltiger charging-Wert: ${charging}` }, { status: 400 });
    }

    const maxWalkM = sp.get("max_walk_m");
    if (maxWalkM) filters.push(`(nearest_walk_m IS NOT NULL AND nearest_walk_m <= ${Number(maxWalkM)})`);

    const minPowerKw = sp.get("min_power_kw");
    if (minPowerKw) filters.push(`nearby_max_power_kw >= ${Number(minPowerKw)}`);

    if (sp.get("connector")) {
      return NextResponse.json(
        { error: "connector wird fuer /api/campsites/search nicht unterstuetzt (siehe Code-Kommentar). Nutze /api/charge-points/search." },
        { status: 400 }
      );
    }

    const trailer = sp.get("trailer");
    if (trailer === "yes_or_unhitch") {
      return NextResponse.json(
        { error: "trailer=yes_or_unhitch wird aktuell nicht unterstuetzt, nur trailer=yes." },
        { status: 400 }
      );
    }
    if (trailer === "yes") filters.push("nearest_trailer_ok_m IS NOT NULL");

    const limit = Math.min(Number(sp.get("limit") ?? "24") || 24, MAX_LIMIT);
    const offset = Number(sp.get("offset") ?? "0") || 0;

    const sort = sp.get("sort");
    let sortExpr: string[] | undefined;
    if (sort === "name") sortExpr = ["name:asc"];
    else if (sort === "charge_quality") sortExpr = ["nearby_max_power_kw:desc"];
    else if (sort === "distance") {
      if (!near) {
        return NextResponse.json({ error: "sort=distance benoetigt den near-Parameter." }, { status: 400 });
      }
      const [lat, lon] = near.split(",").map(Number);
      sortExpr = [`_geoPoint(${lat}, ${lon}):asc`];
    }

    const baseFilters = filters.slice();
    const fullFilters = chargingBase ? [...baseFilters, chargingBase] : baseFilters;

    const [main, onSiteCount, walkingCount, noneCount] = await Promise.all([
      searchIndex<CampsiteSearchRow>("campsites", {
        q,
        filter: fullFilters,
        facets: ["amenities", "country_code"],
        sort: sortExpr,
        limit,
        offset,
      }),
      searchIndex("campsites", { q, filter: [...baseFilters, "charging_on_site = true"], limit: 0 }),
      searchIndex("campsites", { q, filter: [...baseFilters, "nearest_walk_m IS NOT NULL"], limit: 0 }),
      searchIndex("campsites", {
        q,
        filter: [...baseFilters, "(charging_on_site = false AND nearest_walk_m IS NULL)"],
        limit: 0,
      }),
    ]);

    return NextResponse.json({
      total: main.estimatedTotalHits,
      items: main.hits.map((row) => ({
        external_key: row.external_key,
        name: row.name,
        lat: row.lat,
        lon: row.lon,
        country_code: row.country_code,
        amenities: row.amenities,
        charging: {
          on_site: row.charging_on_site,
          on_site_power_kw: row.on_site_power_kw,
          pitch_charging: row.pitch_charging,
          source: row.charging_origin,
          nearest_walk_m: row.nearest_walk_m,
          nearest_trailer_ok_m: row.nearest_trailer_ok_m,
          charge_points_walkable: row.charge_points_walkable,
        },
      })),
      facets: {
        amenities: main.facetDistribution?.amenities ?? {},
        charging: {
          on_site: onSiteCount.estimatedTotalHits,
          walking: walkingCount.estimatedTotalHits,
          none: noneCount.estimatedTotalHits,
        },
      },
      attribution: [
        "© OpenStreetMap contributors (ODbL)",
        "Ladepunkte: Open Charge Map",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
