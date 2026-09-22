import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/api-guard";

/**
 * Auftrag D -- POST /api/enrich/campsites/{key}/charging. Website-
 * Recherche zur Lademoeglichkeit auf dem Campingplatz -- nur Admins
 * (internes Recherche-Workflow, siehe GET /api/enrich/research-queue).
 * Schreibt ueber enrich.submit_campsite_charging() (SECURITY DEFINER,
 * siehe supabase/migrations/20260918000000_enrichment_endpoints.sql).
 * Setzt origin='website_research', checked_at=now(),
 * recheck_after=now()+9 Monate automatisch in der DB-Funktion.
 */

const VALID_CHARGING_TYPES = ["wallbox", "schuko_only", "dc_fast", "cee", "mixed"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ external_key: string }> }) {
  const { external_key: encodedKey } = await params;
  const externalKey = decodeURIComponent(encodedKey);

  const guard = await requireApiAdmin("enrich-campsite-charging", { windowSeconds: 60, maxRequests: 30 });
  if ("response" in guard) return guard.response;

  const supabase = await createClient();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.has_charging !== "boolean") {
    return NextResponse.json({ error: "has_charging (boolean) ist erforderlich." }, { status: 400 });
  }
  if (body.charging_type != null && !VALID_CHARGING_TYPES.includes(body.charging_type)) {
    return NextResponse.json(
      { error: `charging_type muss eines von ${VALID_CHARGING_TYPES.join(", ")} sein.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.schema("enrich").rpc("submit_campsite_charging", {
    p_campsite_key: externalKey,
    p_has_charging: body.has_charging,
    p_charging_type: body.charging_type ?? null,
    p_max_power_kw: typeof body.max_power_kw === "number" ? body.max_power_kw : null,
    p_point_count: typeof body.point_count === "number" ? body.point_count : null,
    p_pitch_charging: typeof body.pitch_charging === "boolean" ? body.pitch_charging : null,
    p_guests_only: typeof body.guests_only === "boolean" ? body.guests_only : null,
    p_booking_required: typeof body.booking_required === "boolean" ? body.booking_required : null,
    p_price_note: typeof body.price_note === "string" ? body.price_note : null,
    p_evidence_url: typeof body.evidence_url === "string" ? body.evidence_url : null,
    p_evidence_quote: typeof body.evidence_quote === "string" ? body.evidence_quote : null,
  });

  if (error) {
    const status = error.message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ campsite_charging: data });
}
