import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/api-guard";

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
  const guard = await requireApiAdmin("research-queue", { windowSeconds: 60, maxRequests: 30 });
  if ("response" in guard) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase.schema("core").rpc("research_queue");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ total: data?.length ?? 0, items: data ?? [] });
}
