import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auftrag D -- POST /api/enrich/charge-points/{key}/trailer/moderate.
 * Nur Admins (profiles.is_admin) duerfen Meldungen freigeben/ablehnen --
 * bei Freigabe wird enrich.trailer_suitability ueber die
 * SECURITY DEFINER-Funktion enrich.moderate_trailer_report() neu
 * berechnet (gewichtete Mehrheit nach app_user.trust_level, Gleichstand
 * zugunsten der konservativeren Aussage no > unhitch > yes, siehe
 * Auftragsdokument Abschnitt 9 "Aggregationsregel").
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ external_key: string }> }) {
  const { external_key: encodedKey } = await params;
  const externalKey = decodeURIComponent(encodedKey);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile?.is_admin) return NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.report_id !== "number" || !["approve", "reject"].includes(body.decision)) {
    return NextResponse.json(
      { error: "report_id (number) und decision ('approve'|'reject') sind erforderlich." },
      { status: 400 }
    );
  }

  const { data: existingReport, error: fetchError } = await supabase
    .schema("enrich")
    .from("trailer_report")
    .select("charge_point_key")
    .eq("id", body.report_id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existingReport) return NextResponse.json({ error: `trailer_report ${body.report_id} nicht gefunden.` }, { status: 404 });
  if (existingReport.charge_point_key !== externalKey) {
    return NextResponse.json(
      { error: "report_id gehoert zu einem anderen Ladepunkt als in der URL angegeben." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.schema("enrich").rpc("moderate_trailer_report", {
    p_report_id: body.report_id,
    p_decision: body.decision,
    p_moderator_id: user.id,
  });

  if (error) {
    const status = error.message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
