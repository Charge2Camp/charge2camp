"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { parseCsvWithHeader } from "@/lib/csv";

export interface BulkUploadRowIssue {
  external_key: string;
  reason: string;
}

export interface BulkUploadResult {
  ok: boolean;
  error?: string;
  totalRows: number;
  coreUpdated: number;
  trailerUpdated: number;
  issues: BulkUploadRowIssue[];
}

const EMPTY_RESULT: Omit<BulkUploadResult, "ok"> = { totalRows: 0, coreUpdated: 0, trailerUpdated: 0, issues: [] };

const TRUE_TOKENS = new Set(["1", "true", "ja", "yes", "wahr"]);
const FALSE_TOKENS = new Set(["0", "false", "nein", "no", "falsch"]);
const VALID_VERDICTS = new Set(["yes", "unhitch", "no", "unknown"]);
const VALID_ACCESS = new Set(["public", "restricted", "private"]);
const VALID_MANEUVERING = new Set(["ample", "tight", "none"]);

/** Leeres Feld = "unveraendert lassen" (Bulk-Teil-Update, siehe
 * Vorlagen-Route-Handler) -- anders als die Ladestationen-Detailseite, die
 * beim Speichern IMMER alle Felder ueberschreibt. Bei einem Massenupload
 * fuer z. B. nur die Anhaengertauglichkeit ueber hunderte Stationen waere
 * ein "alles ueberschreiben"-Verhalten destruktiv (wuerde Name/Betreiber/
 * etc. auf leer setzen, wenn die Vorlage dafuer keine Werte enthaelt). */
function triBool(raw: string | undefined): boolean | null | "invalid" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return null;
  if (TRUE_TOKENS.has(v)) return true;
  if (FALSE_TOKENS.has(v)) return false;
  return "invalid";
}

export async function bulkUpdateChargePoints(
  _prev: BulkUploadResult,
  formData: FormData
): Promise<BulkUploadResult> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine CSV-Datei auswählen.", ...EMPTY_RESULT };
  }

  const text = await file.text();
  const rows = parseCsvWithHeader(text);
  if (rows.length === 0) {
    return { ok: false, error: "Die Datei enthält keine Datenzeilen.", ...EMPTY_RESULT };
  }

  const supabase = createServiceClient();
  const issues: BulkUploadRowIssue[] = [];

  const externalKeys = Array.from(
    new Set(rows.map((r) => r.external_key?.trim()).filter((k): k is string => Boolean(k)))
  );

  // Alle betroffenen Ladepunkte + bestehende Anhaengertauglichkeits-Zeilen
  // vorab in je EINER Abfrage laden statt pro Zeile -- vermeidet hunderte
  // einzelne Roundtrips bei einer grossen Datei.
  const [{ data: existingPoints }, { data: existingTrailer }] = await Promise.all([
    externalKeys.length > 0
      ? supabase.schema("core").from("charge_point").select("id, external_key").in("external_key", externalKeys)
      : Promise.resolve({ data: [] }),
    externalKeys.length > 0
      ? supabase.schema("enrich").from("trailer_suitability").select("*").in("charge_point_key", externalKeys)
      : Promise.resolve({ data: [] }),
  ]);
  const pointByKey = new Map((existingPoints ?? []).map((p) => [p.external_key as string, p as { id: string }]));
  const trailerByKey = new Map(
    (existingTrailer ?? []).map((t) => [
      t.charge_point_key as string,
      t as { verdict: string; drive_through: boolean | null; maneuvering_space: string | null; pull_in_length_m: number | null; notes: string | null },
    ])
  );

  let coreUpdated = 0;
  let trailerUpdated = 0;
  let appUserEnsured = false;

  for (const row of rows) {
    const externalKey = row.external_key?.trim();
    if (!externalKey) {
      issues.push({ external_key: "(leer)", reason: "Keine external_key angegeben -- Zeile übersprungen." });
      continue;
    }

    const point = pointByKey.get(externalKey);
    if (!point) {
      issues.push({ external_key: externalKey, reason: "Kein Ladepunkt mit dieser external_key gefunden." });
      continue;
    }

    // Stammdaten -- nur nicht-leere Felder werden uebernommen.
    const coreUpdate: Record<string, unknown> = {};
    if (row.name?.trim()) coreUpdate.name = row.name.trim();
    if (row.operator?.trim()) coreUpdate.operator = row.operator.trim();
    if (row.address?.trim()) coreUpdate.address = row.address.trim();
    if (row.city?.trim()) coreUpdate.city = row.city.trim();
    if (row.country_code?.trim()) coreUpdate.country_code = row.country_code.trim();

    if (row.access_type?.trim()) {
      const v = row.access_type.trim().toLowerCase();
      if (VALID_ACCESS.has(v)) coreUpdate.access_type = v;
      else issues.push({ external_key: externalKey, reason: `Ungültiger Wert "${row.access_type}" für Zugang -- Feld unverändert.` });
    }

    if (row.max_power_kw?.trim()) {
      const n = Number(row.max_power_kw);
      if (Number.isFinite(n) && n >= 0) coreUpdate.max_power_kw = n;
      else issues.push({ external_key: externalKey, reason: `Ungültige Zahl "${row.max_power_kw}" für Max. Leistung -- Feld unverändert.` });
    }

    const isOperational = triBool(row.is_operational);
    if (isOperational === "invalid") {
      issues.push({ external_key: externalKey, reason: `Ungültiger Wert "${row.is_operational}" für Betriebsbereit -- Feld unverändert.` });
    } else if (isOperational !== null) {
      coreUpdate.is_operational = isOperational;
    }

    if (Object.keys(coreUpdate).length > 0) {
      coreUpdate.updated_at = new Date().toISOString();
      const { error } = await supabase.schema("core").from("charge_point").update(coreUpdate).eq("id", point.id);
      if (error) issues.push({ external_key: externalKey, reason: `Stammdaten-Update fehlgeschlagen: ${error.message}` });
      else coreUpdated++;
    }

    // Anhaengertauglichkeit -- nur anfassen, wenn mindestens eines der
    // Felder in der Zeile gesetzt ist.
    const driveThrough = triBool(row.drive_through);
    if (driveThrough === "invalid") {
      issues.push({ external_key: externalKey, reason: `Ungültiger Wert "${row.drive_through}" für Drive-Through -- Feld unverändert.` });
    }

    let maneuveringSpace: string | undefined;
    if (row.maneuvering_space?.trim()) {
      const v = row.maneuvering_space.trim().toLowerCase();
      if (VALID_MANEUVERING.has(v)) maneuveringSpace = v;
      else issues.push({ external_key: externalKey, reason: `Ungültiger Wert "${row.maneuvering_space}" für Rangierfläche -- Feld unverändert.` });
    }

    let pullInLength: number | undefined;
    if (row.pull_in_length_m?.trim()) {
      const n = Number(row.pull_in_length_m);
      if (Number.isFinite(n) && n >= 0) pullInLength = n;
      else issues.push({ external_key: externalKey, reason: `Ungültige Zahl "${row.pull_in_length_m}" für Einfahrlänge -- Feld unverändert.` });
    }

    let verdict: string | undefined;
    if (row.trailer_verdict?.trim()) {
      const v = row.trailer_verdict.trim().toLowerCase();
      if (VALID_VERDICTS.has(v)) verdict = v;
      else issues.push({ external_key: externalKey, reason: `Ungültiger Wert "${row.trailer_verdict}" für Anhängertauglichkeit -- Feld unverändert.` });
    }

    const notes = row.notes?.trim() ? row.notes.trim() : undefined;
    const driveThroughProvided = driveThrough === true || driveThrough === false;
    const hasTrailerChange =
      verdict !== undefined || driveThroughProvided || maneuveringSpace !== undefined || pullInLength !== undefined || notes !== undefined;

    if (hasTrailerChange) {
      const existing = trailerByKey.get(externalKey);
      if (!existing && verdict === undefined) {
        issues.push({
          external_key: externalKey,
          reason:
            "Anhängertauglichkeits-Felder angegeben, aber weder eine Einstufung noch ein bestehender Eintrag -- übersprungen (Einstufung ist beim erstmaligen Anlegen Pflicht).",
        });
      } else {
        if (!appUserEnsured) {
          // Siehe ladestationen/[id]/actions.ts overrideTrailerSuitability --
          // verified_by braucht einen passenden enrich.app_user-Eintrag.
          await supabase
            .schema("enrich")
            .from("app_user")
            .upsert({ id: admin.id, display_name: null, trust_level: 5 }, { onConflict: "id", ignoreDuplicates: true });
          appUserEnsured = true;
        }

        const { error } = await supabase.schema("enrich").from("trailer_suitability").upsert(
          {
            charge_point_key: externalKey,
            verdict: verdict ?? existing!.verdict,
            drive_through: driveThroughProvided ? driveThrough : (existing?.drive_through ?? null),
            maneuvering_space: maneuveringSpace ?? existing?.maneuvering_space ?? null,
            pull_in_length_m: pullInLength ?? existing?.pull_in_length_m ?? null,
            notes: notes ?? existing?.notes ?? null,
            origin: "admin_bulk_upload",
            verified_at: new Date().toISOString(),
            verified_by: admin.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "charge_point_key" }
        );
        if (error) issues.push({ external_key: externalKey, reason: `Anhängertauglichkeit-Update fehlgeschlagen: ${error.message}` });
        else trailerUpdated++;
      }
    }
  }

  revalidatePath("/ladestationen");

  return { ok: true, totalRows: rows.length, coreUpdated, trailerUpdated, issues };
}
