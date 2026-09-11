import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/charge-points/{external_key}/images (Auftrag "Ladesaeulen-
 * Bilder" §5). Liest ausschliesslich aus core.v_charge_point_image (wendet
 * enrich.charge_point_image_override bereits an) -- nie direkt aus
 * core.charge_point_image. Immer HTTP 200, auch ohne Treffer (kein 404),
 * damit das Frontend den "keine Bilder"-Zustand ohne Fehlerbehandlung
 * abbilden kann.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ external_key: string }> }
) {
  const { external_key: encodedKey } = await params;
  const externalKey = decodeURIComponent(encodedKey);

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("v_charge_point_image")
    .select(
      "url_full, url_thumb, width, height, source, license, license_url, attribution, captured_at, distance_m"
    )
    .eq("external_key", externalKey)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const images = data ?? [];

  return NextResponse.json(
    {
      external_key: externalKey,
      count: images.length,
      images,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
