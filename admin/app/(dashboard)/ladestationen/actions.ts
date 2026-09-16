"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Nur Felder, bei denen es sinnvoll ist, MEHREREN unterschiedlichen
 * Stationen denselben Wert zuzuweisen (Nutzerwunsch: z.B. bei allen
 * faelschlich als "ladenetz.de" statt "Stadtwerke Muenchen" gefuehrten
 * Stationen den Betreiber in einem Schritt korrigieren). Bewusst OHNE
 * name/address/max_power_kw/Koordinaten -- die sind je Station individuell,
 * ein Massen-Ueberschreiben ergibt dort keinen Sinn und waere gefaehrlich. */
const BULK_EDITABLE_FIELDS = ["operator", "access_type", "country_code", "is_operational"] as const;
export type BulkEditableField = (typeof BULK_EDITABLE_FIELDS)[number];

export async function bulkUpdateChargePoints(formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const ids = formData.getAll("station_id").map(String).filter(Boolean);
  const field = formData.get("field") as string;
  const rawValue = (formData.get("value") as string) ?? "";

  if (ids.length === 0) throw new Error("Keine Ladestationen ausgewählt.");
  if (!BULK_EDITABLE_FIELDS.includes(field as BulkEditableField)) {
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
