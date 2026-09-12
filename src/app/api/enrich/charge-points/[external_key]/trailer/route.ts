import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auftrag D -- POST /api/enrich/charge-points/{key}/trailer (siehe
 * CLAUDE_CODE_AUFTRAG.md Abschnitt 9, "Anreicherungs-Endpunkte"). Jeder
 * eingeloggte Nutzer kann eine Anhaengertauglichkeits-Meldung abgeben --
 * landet mit status='pending' in enrich.trailer_report, bis ein Admin sie
 * ueber POST .../trailer/moderate freigibt oder ablehnt (siehe dortige
 * route.ts). Schreibt ueber die SECURITY DEFINER-Funktion enrich.
 * submit_trailer_report() (siehe
 * supabase/migrations/20260918000000_enrichment_endpoints.sql), da es fuer
 * enrich.* bewusst keine INSERT-RLS-Policy gibt.
 */

const VALID_VERDICTS = ["yes", "unhitch", "no"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ external_key: string }> }) {
  const { external_key: encodedKey } = await params;
  const externalKey = decodeURIComponent(encodedKey);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.verdict !== "string" || !VALID_VERDICTS.includes(body.verdict)) {
    return NextResponse.json(
      { error: `verdict ist erforderlich und muss eines von ${VALID_VERDICTS.join(", ")} sein.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.schema("enrich").rpc("submit_trailer_report", {
    p_charge_point_key: externalKey,
    p_user_id: user.id,
    // Bewusst KEINE E-Mail-Adresse (frueher user.email) -- enrich.app_user
    // ist oeffentlich abfragbare Infrastruktur (core/enrich, siehe
    // 20260915000000_data_layer_api_exposure.sql), display_name wird in der
    // App nirgends angezeigt und war dadurch ein unnoetiges PII-Leck
    // (siehe 20260927000000_security_hardening_admin_rpcs.sql).
    p_display_name: null,
    p_verdict: body.verdict,
    p_drive_through: typeof body.drive_through === "boolean" ? body.drive_through : null,
    p_notes: typeof body.notes === "string" ? body.notes : null,
    p_photo_url: typeof body.photo_url === "string" ? body.photo_url : null,
    p_rig_length_m: typeof body.rig_length_m === "number" ? body.rig_length_m : null,
  });

  if (error) {
    const status = error.message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ report: data }, { status: 201 });
}
