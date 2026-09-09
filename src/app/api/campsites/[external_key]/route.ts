import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchLinkedChargePoints } from "@/lib/campsite-charging-links";
import type { CoreCampsite, CoreConnector } from "@/types/database";

/**
 * Auftrag D -- GET /api/campsites/{external_key} (siehe
 * CLAUDE_CODE_AUFTRAG.md Abschnitt 9). Volles Objekt inkl. verknuepfter
 * Ladepunkte mit Anschluessen -- direkt aus Postgres/PostgREST, nicht aus
 * Meilisearch (der Index enthaelt nur die aggregierten Suchfelder aus
 * core.campsite_search, keine Einzel-Ladepunkt-/Anschlussdaten).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ external_key: string }> }
) {
  const { external_key: encodedKey } = await params;
  const externalKey = decodeURIComponent(encodedKey);

  const supabase = await createClient();
  const { data: campsite, error } = await supabase
    .schema("core")
    .from("campsite")
    .select("*")
    .eq("external_key", externalKey)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!campsite) return NextResponse.json({ error: "Campingplatz nicht gefunden." }, { status: 404 });

  const cs = campsite as CoreCampsite;

  const [{ data: amenityRows }, { data: searchRow }, linkedChargePoints] = await Promise.all([
    supabase.schema("core").from("campsite_amenity").select("*").eq("campsite_id", cs.id).eq("value_bool", true),
    supabase.schema("core").from("campsite_search").select("lat, lon").eq("id", cs.id).maybeSingle(),
    fetchLinkedChargePoints(cs.id),
  ]);

  const chargePointIds = linkedChargePoints.map((cp) => cp.id);
  const { data: connectorRows } =
    chargePointIds.length > 0
      ? await supabase.schema("core").from("connector").select("*").in("charge_point_id", chargePointIds)
      : { data: [] as CoreConnector[] };
  const connectorsByChargePointId = new Map<string, CoreConnector[]>();
  for (const c of (connectorRows as CoreConnector[]) ?? []) {
    const list = connectorsByChargePointId.get(c.charge_point_id) ?? [];
    list.push(c);
    connectorsByChargePointId.set(c.charge_point_id, list);
  }

  return NextResponse.json({
    external_key: cs.external_key,
    name: cs.name,
    lat: searchRow?.lat ?? null,
    lon: searchRow?.lon ?? null,
    country_code: cs.country_code,
    city: cs.city,
    address: cs.address,
    website: cs.website,
    phone: cs.phone,
    email: cs.email,
    capacity: cs.capacity,
    amenities: (amenityRows ?? []).map((a) => a.amenity_key),
    charge_points: linkedChargePoints.map((cp) => ({
      external_key: cp.external_key,
      name: cp.name,
      operator: cp.operator,
      relation: cp.relation,
      walk_distance_m: cp.relation === "on_site" ? 0 : cp.walk_distance_m,
      max_power_kw: cp.max_power_kw,
      connectors: (connectorsByChargePointId.get(cp.id) ?? []).map((c) => ({
        standard: c.standard,
        power_kw: c.power_kw,
        current_type: c.current_type,
        quantity: c.quantity,
      })),
      trailer: { verdict: cp.trailerVerdict },
    })),
    attribution: ["© OpenStreetMap contributors (ODbL)", "Ladepunkte: Open Charge Map"],
  });
}
