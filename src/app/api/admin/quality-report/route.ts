import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auftrag F -- GET /api/admin/quality-report (siehe CLAUDE_CODE_AUFTRAG.md
 * Abschnitt 11). Ruft core.run_quality_checks() per RPC ab (siehe
 * supabase/migrations/20260917000000_quality_checks.sql) -- dieselben zehn
 * Abfragen wie sql/90_quality_checks.sql, hier in einem Aufruf gebuendelt.
 *
 * Nur fuer eingeloggte Admins (profiles.is_admin) -- es gibt noch keine
 * eigene Admin-Oberflaeche in der App, dieser Endpunkt ist der erste
 * Baustein dafuer.
 */

const ALL_CHECKS = [
  "coverage_by_country",
  "coordinate_plausibility",
  "duplicate_charge_points",
  "duplicate_campsites",
  "orphaned_enrichment",
  "stale_records",
  "disputed_verdicts",
  "link_sanity",
  "amenity_fill_rate",
  "research_progress",
] as const;

export async function GET() {
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

  const { data, error } = await supabase.schema("core").rpc("run_quality_checks");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { check_name: string; data: unknown }[];
  const checks: Record<string, unknown[]> = Object.fromEntries(ALL_CHECKS.map((name) => [name, []]));
  for (const row of rows) {
    (checks[row.check_name] ??= []).push(row.data);
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    checks,
  });
}
