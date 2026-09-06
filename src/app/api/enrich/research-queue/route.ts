import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auftrag D -- GET /api/enrich/research-queue. Offene Website-Recherche-
 * Aufgaben: Campingplaetze mit Website ohne bisherigen enrich.
 * campsite_charging-Eintrag, plus faellige Rechecks (recheck_after <
 * heute) -- sortiert nach Land/Ort (core.research_queue(), siehe
 * supabase/migrations/20260918000000_enrichment_endpoints.sql), damit
 * regionsweise abgearbeitet werden kann. Nur Admins (internes
 * Recherche-Workflow).
 */
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

  const { data, error } = await supabase.schema("core").rpc("research_queue");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ total: data?.length ?? 0, items: data ?? [] });
}
