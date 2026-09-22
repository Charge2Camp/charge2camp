import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManeuveringSpace, TrailerVerdict } from "@/lib/types";

export const CONNECTOR_ROWS = 6;

export function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") throw new Error("Pflichtfeld fehlt.");
  return value.trim();
}

export function optionalString(value: FormDataEntryValue | null): string | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Anders als optionalNumber() (u.a. fuer Breiten-/Laengengrad genutzt, wo 0
// und negative Werte gueltig sind) -- fuer Ladeleistung/Einfahrlaenge/
// Anschlussanzahl ist 0 oder negativ nie ein sinnvoller Wert (Audit-Befund
// 2026-09-22, gleiche Klasse wie in src/app/profil/actions.ts gefixt).
export function optionalPositiveNumber(value: FormDataEntryValue | null): number | null {
  const parsed = optionalNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function requireCoordinate(value: FormDataEntryValue | null, label: string): number {
  const parsed = optionalNumber(value);
  if (parsed === null) throw new Error(`${label} ist ein Pflichtfeld.`);
  return parsed;
}

interface ConnectorInput {
  standard: string;
  power_kw: number | null;
  current_type: string | null;
  quantity: number;
}

export function readConnectors(formData: FormData): ConnectorInput[] {
  const rows: ConnectorInput[] = [];
  for (let i = 0; i < CONNECTOR_ROWS; i++) {
    const standard = optionalString(formData.get(`connector_standard_${i}`));
    if (!standard) continue;
    rows.push({
      standard,
      power_kw: optionalPositiveNumber(formData.get(`connector_power_kw_${i}`)),
      current_type: optionalString(formData.get(`connector_current_type_${i}`)),
      quantity: optionalPositiveNumber(formData.get(`connector_quantity_${i}`)) ?? 1,
    });
  }
  return rows;
}

/** Kernlogik der manuellen Ladestations-Anlage, herausgezogen aus dem
 * urspruenglich alleinstehenden addChargePoint() (ladestationen/neu/actions.ts),
 * damit sie auch von der Freigabe einer Nutzer-Meldung
 * (ladestationen/fehlende-saeulen/[reportId]/actions.ts) wiederverwendet
 * werden kann -- beide Wege sollen exakt denselben, einmal geprueften
 * Schreibpfad benutzen statt einer zweiten, potenziell abweichenden Kopie.
 *
 * Landet in core.charge_point mit source="admin_manual" (siehe
 * docs/data-sources.md) statt "ocm", damit spaeter erkennbar bleibt, dass
 * diese Station nicht aus dem automatischen Ingest stammt. external_key
 * bekommt das Praefix "manual:" (Konvention analog zu "ocm:<id>").
 *
 * Leistung/Anschlusszahl werden -- wie im OCM-Ingest -- aus den eingegebenen
 * Anschluessen abgeleitet statt separat abgefragt, damit Stammdaten und
 * Anschluesse nicht auseinanderlaufen koennen. */
export async function createChargePointFromFormData(
  formData: FormData,
  admin: { id: string },
  supabase: SupabaseClient
): Promise<{ id: string }> {
  const connectors = readConnectors(formData);
  const powerValues = connectors.map((c) => c.power_kw).filter((v): v is number => v !== null);
  const maxPowerKw = powerValues.length > 0 ? Math.max(...powerValues) : null;
  const connectorCount = connectors.length > 0 ? connectors.reduce((sum, c) => sum + c.quantity, 0) : null;

  const lat = requireCoordinate(formData.get("latitude"), "Breitengrad");
  const lon = requireCoordinate(formData.get("longitude"), "Längengrad");
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Breiten-/Längengrad außerhalb des gültigen Bereichs.");
  }

  const externalKey = `manual:${randomUUID()}`;

  const { data: created, error } = await supabase
    .schema("core")
    .from("charge_point")
    .insert({
      external_key: externalKey,
      name: requireString(formData.get("name")),
      operator: optionalString(formData.get("operator")),
      network: optionalString(formData.get("network")),
      geom: `SRID=4326;POINT(${lon} ${lat})`,
      address: optionalString(formData.get("address")),
      postcode: optionalString(formData.get("postcode")),
      city: optionalString(formData.get("city")),
      country_code: optionalString(formData.get("country_code"))?.toUpperCase() ?? null,
      access_type: optionalString(formData.get("access_type")),
      is_operational: formData.get("is_operational") === "1",
      max_power_kw: maxPowerKw,
      connector_count: connectorCount,
      source: "admin_manual",
      source_updated_at: new Date().toISOString(),
      // Nutzerwunsch: von Hand angelegte/aus einer Meldung uebernommene
      // Stationen sollen von Anfang an vor automatischer Ueberschreibung
      // geschuetzt sein, gleiches Prinzip wie bei der manuellen Korrektur
      // bestehender Stationen (siehe ladestationen/[id]/actions.ts). Der
      // "manual:"-external_key kollidiert ohnehin nie mit einem
      // "ocm:<id>"-Key, aber das Flag haelt die Absicht explizit fest --
      // z.B. falls diese Station spaeter mit einem OCM-Duplikat
      // zusammengefuehrt wird (core.merge_charge_points).
      manual_override: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (connectors.length > 0) {
    const { error: connectorError } = await supabase
      .schema("core")
      .from("connector")
      .insert(
        connectors.map((c) => ({
          charge_point_id: created.id,
          standard: c.standard,
          power_kw: c.power_kw,
          current_type: c.current_type,
          quantity: c.quantity,
        }))
      );
    if (connectorError) throw new Error(connectorError.message);
  }

  // enrich.app_user ist von auth.users entkoppelt (siehe [id]/actions.ts
  // overrideTrailerSuitability) -- fuer verified_by muss der Eintrag zuerst
  // existieren.
  await supabase.schema("enrich").from("app_user").upsert(
    { id: admin.id, display_name: null, trust_level: 5 },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const verdict = (formData.get("verdict") as TrailerVerdict) || "unknown";
  const maneuveringSpace = optionalString(formData.get("maneuvering_space"));
  const { error: trailerError } = await supabase.schema("enrich").from("trailer_suitability").insert({
    charge_point_key: externalKey,
    verdict,
    drive_through: formData.get("drive_through") === "1",
    pull_in_length_m: optionalPositiveNumber(formData.get("pull_in_length_m")),
    maneuvering_space: maneuveringSpace as ManeuveringSpace | null,
    notes: optionalString(formData.get("notes")),
    origin: "admin_manual",
    verified_at: new Date().toISOString(),
    verified_by: admin.id,
  });
  if (trailerError) throw new Error(trailerError.message);

  return { id: created.id };
}
