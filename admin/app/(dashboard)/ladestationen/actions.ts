"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { TrailerVerdict } from "@/lib/types";

/** Felder aus core.charge_point, bei denen es sinnvoll ist, MEHREREN
 * unterschiedlichen Stationen denselben Wert zuzuweisen (Nutzerwunsch: z.B.
 * bei allen faelschlich als "ladenetz.de" statt "Stadtwerke Muenchen"
 * gefuehrten Stationen den Betreiber in einem Schritt korrigieren). Bewusst
 * OHNE name/address/max_power_kw/Koordinaten -- die sind je Station
 * individuell, ein Massen-Ueberschreiben ergibt dort keinen Sinn. */
const CHARGE_POINT_FIELDS = ["operator", "access_type", "country_code", "is_operational"] as const;
// Anhaengertauglichkeit/Drive-Through liegen NICHT auf core.charge_point,
// sondern in enrich.trailer_suitability (Schluessel: external_key, nicht
// id) -- eigener Codepfad unten, gleiche Auswahl-UI (siehe station-list.tsx).
const TRAILER_FIELDS = ["trailer_verdict", "drive_through"] as const;

export type BulkEditableField = (typeof CHARGE_POINT_FIELDS)[number] | (typeof TRAILER_FIELDS)[number];

export async function bulkUpdateChargePoints(formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  const ids = formData.getAll("station_id").map(String).filter(Boolean);
  const field = formData.get("field") as string;
  const rawValue = (formData.get("value") as string) ?? "";

  if (ids.length === 0) throw new Error("Keine Ladestationen ausgewählt.");

  if ((TRAILER_FIELDS as readonly string[]).includes(field)) {
    await bulkUpdateTrailerSuitability(supabase, admin.id, ids, field as (typeof TRAILER_FIELDS)[number], rawValue);
    revalidatePath("/ladestationen");
    return;
  }

  if (!(CHARGE_POINT_FIELDS as readonly string[]).includes(field)) {
    throw new Error("Ungültiges Feld für Massen-Bearbeitung.");
  }

  let value: string | boolean | null = rawValue;
  if (field === "is_operational") {
    value = rawValue === "1";
  } else {
    value = rawValue.trim() || null;
    if (field === "country_code" && typeof value === "string" && value.length !== 2) {
      throw new Error("Land muss ein zweistelliger ISO-Code sein (z. B. DE).");
    }
  }

  // manual_override = true wie bei der Einzelbearbeitung (updateChargePoint)
  // -- eine bewusste Massenkorrektur soll den naechsten OCM-Reimport genauso
  // ueberstehen wie eine Einzelkorrektur, siehe
  // 20261001000000_charge_point_manual_override.sql.
  const update: Record<string, unknown> = {
    [field]: value,
    manual_override: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.schema("core").from("charge_point").update(update).in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/ladestationen");
}

/** Aktualisiert NUR das eine geaenderte Feld (verdict ODER drive_through),
 * ohne die restlichen enrich.trailer_suitability-Spalten einer Station
 * (Notizen, Rangierflaeche, Einfahrlaenge, ...) zu verwerfen -- ein
 * einfaches upsert() mit nur dem geaenderten Feld wuerde diese sonst auf
 * NULL zuruecksetzen, weil Postgres bei ON CONFLICT DO UPDATE nur die
 * uebergebenen Spalten kennt, alle anderen aus dem INSERT-Zweig kaemen also
 * mit Default/NULL. Deshalb: erst bestehende Zeilen laden, mergen, dann erst
 * upserten. Gleiches origin="admin_override"-Prinzip wie
 * overrideTrailerSuitability() in ladestationen/[id]/actions.ts. */
async function bulkUpdateTrailerSuitability(
  supabase: ReturnType<typeof createServiceClient>,
  adminId: string,
  chargePointIds: string[],
  field: "trailer_verdict" | "drive_through",
  rawValue: string
) {
  if (field === "trailer_verdict" && !["yes", "unhitch", "no", "unknown"].includes(rawValue)) {
    throw new Error("Ungültige Einstufung.");
  }

  const { data: stations, error: stationsError } = await supabase
    .schema("core")
    .from("charge_point")
    .select("external_key")
    .in("id", chargePointIds);
  if (stationsError) throw new Error(stationsError.message);
  const keys = (stations ?? []).map((s) => s.external_key as string);
  if (keys.length === 0) throw new Error("Keine gültigen Ladepunkte gefunden.");

  const { data: existingRows, error: existingError } = await supabase
    .schema("enrich")
    .from("trailer_suitability")
    .select("*")
    .in("charge_point_key", keys);
  if (existingError) throw new Error(existingError.message);
  const existingByKey = new Map((existingRows ?? []).map((r) => [r.charge_point_key as string, r]));

  await supabase.schema("enrich").from("app_user").upsert({ id: adminId, display_name: null, trust_level: 5 }, { onConflict: "id", ignoreDuplicates: true });

  const now = new Date().toISOString();
  const rows = keys.map((key) => {
    const existing = existingByKey.get(key) as
      | {
          verdict: TrailerVerdict;
          drive_through: boolean | null;
          maneuvering_space: string | null;
          pull_in_length_m: number | null;
          notes: string | null;
          confirm_count: number | null;
          dispute_count: number | null;
        }
      | undefined;

    return {
      charge_point_key: key,
      verdict: field === "trailer_verdict" ? (rawValue as TrailerVerdict) : existing?.verdict ?? "unknown",
      drive_through: field === "drive_through" ? rawValue === "1" : existing?.drive_through ?? null,
      maneuvering_space: existing?.maneuvering_space ?? null,
      pull_in_length_m: existing?.pull_in_length_m ?? null,
      notes: existing?.notes ?? null,
      confirm_count: existing?.confirm_count ?? 0,
      dispute_count: existing?.dispute_count ?? 0,
      origin: "admin_override",
      verified_at: now,
      verified_by: adminId,
      updated_at: now,
    };
  });

  const { error } = await supabase.schema("enrich").from("trailer_suitability").upsert(rows, { onConflict: "charge_point_key" });
  if (error) throw new Error(error.message);
}
