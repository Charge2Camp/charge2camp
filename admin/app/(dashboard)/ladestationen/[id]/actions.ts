"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { optionalPositiveNumber } from "@/lib/charge-point-write";
import type { ManeuveringSpace, TrailerVerdict } from "@/lib/types";

export async function updateChargePoint(chargePointId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    name: (formData.get("name") as string) || null,
    operator: (formData.get("operator") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    country_code: (formData.get("country_code") as string) || null,
    access_type: (formData.get("access_type") as string) || null,
    is_operational: formData.get("is_operational") === "1",
    max_power_kw: optionalPositiveNumber(formData.get("max_power_kw")),
    // Jedes Speichern hier ist eine bewusste Admin-Korrektur -- die soll nie
    // ohne Rueckfrage vom naechtlichen OCM-Reimport rueckgaengig gemacht
    // werden (Nutzerfeedback: "generell nicht, egal welche Daten"). Bewusst
    // KEINE Checkbox dafuer mehr (siehe vorherige Version) -- die war
    // vergessbar und liess die Korrektur beim Nicht-Ankreuzen wirkungslos
    // verfallen. Aufheben nur noch explizit ueber releaseManualOverride().
    manual_override: true,
    updated_at: new Date().toISOString(),
  };

  // Koordinaten-Korrektur (Auslöser: "Unplausible Koordinaten" im
  // Datenqualitäts-Check auf dem Dashboard) -- core.charge_point.geom ist
  // geography(Point,4326); PostgREST akzeptiert dafür direkt einen
  // EWKT-Text ("SRID=4326;POINT(lon lat)"), keine gesonderte RPC nötig
  // (siehe ladestationen/neu/actions.ts, gleiches Muster).
  const latRaw = formData.get("latitude");
  const lonRaw = formData.get("longitude");
  if (typeof latRaw === "string" && latRaw.trim() && typeof lonRaw === "string" && lonRaw.trim()) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Ungültiger Breitengrad.");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error("Ungültiger Längengrad.");
    update.geom = `SRID=4326;POINT(${lon} ${lat})`;
  }

  const { error } = await supabase.schema("core").from("charge_point").update(update).eq("id", chargePointId);

  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
}

/** Manuelle Korrektur der Anhaengertauglichkeit durch einen Admin --
 * schreibt UNABHAENGIG von der community-basierten Meldungs-/
 * Moderations-Warteschlange (enrich.trailer_report / moderate_trailer_report)
 * ueber enrich.set_trailer_suitability() -- die einzige erlaubte
 * Schreibfunktion (siehe supabase/migrations/
 * 20261012000000_field_provenance_and_source_registry.sql). Die Funktion
 * setzt manual_override=true + source_type='MANUAL' automatisch, weil
 * origin='admin_override' uebergeben wird; damit ist die Bewertung ab sofort
 * hart geschuetzt (Auftragsdokument Abschnitt 3), nicht mehr nur per
 * origin-Konvention. */
export async function overrideTrailerSuitability(chargePointKey: string, formData: FormData) {
  const admin = await requireAdmin();
  const supabase = createServiceClient();

  // enrich.app_user ist ein von auth.users ENTKOPPELTER Identitaetsraum --
  // per Konvention (siehe enrich.submit_trailer_report/moderate_trailer_report
  // in supabase/migrations/20260918000000_enrichment_endpoints.sql) wird
  // trotzdem dieselbe UUID wie in auth.users verwendet, verified_by
  // referenziert also KEINEN auth.users-Eintrag direkt, sondern setzt
  // voraus, dass vorher ein passender app_user existiert -- sonst schlaegt
  // der Foreign-Key auf trailer_suitability.verified_by fehl.
  // Bewusst KEINE E-Mail-Adresse (frueher admin.email) -- display_name wird
  // in der App nirgends angezeigt und war ueber die oeffentlich abfragbare
  // enrich.app_user-Tabelle ein unnoetiges PII-Leck (siehe
  // supabase/migrations/20260927000000_security_hardening_admin_rpcs.sql).
  await supabase.schema("enrich").from("app_user").upsert(
    { id: admin.id, display_name: null, trust_level: 5 },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const verdict = formData.get("verdict") as TrailerVerdict;
  const maneuveringSpace = (formData.get("maneuvering_space") as string) || null;

  const { error } = await supabase.schema("enrich").rpc("set_trailer_suitability", {
    p_charge_point_key: chargePointKey,
    p_verdict: verdict,
    p_origin: "admin_override",
    p_drive_through: formData.get("drive_through") === "1",
    p_pull_in_length_m: optionalPositiveNumber(formData.get("pull_in_length_m")),
    p_maneuvering_space: maneuveringSpace as ManeuveringSpace | null,
    p_notes: (formData.get("notes") as string) || null,
    p_verified_by: admin.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen`);
}

/** Hebt die Fixierung wieder auf -- ab dann darf der naechtliche OCM-Import
 * Stammdaten fuer diese Station wieder normal aktualisieren. Bewusst eine
 * eigene, explizite Aktion statt einer Checkbox im Speichern-Formular (siehe
 * updateChargePoint): Freigeben ist ein bewusster, seltener Schritt, kein
 * versehentliches Nebenprodukt eines Tippfehler-Fixes. */
export async function releaseManualOverride(chargePointId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.schema("core").from("charge_point").update({ manual_override: false }).eq("id", chargePointId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
}

/** core.charge_point_geo (die einzige Quelle, aus der die Haupt-App
 * Ladestationen liest) ist eine einfache VIEW mit `where cp.is_active` --
 * kein Refresh noetig, die Aenderung wirkt sofort (siehe Migration
 * 20260909020000_campsite_charge_point_active_flag.sql). */
export async function setChargePointActive(chargePointId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();
  // deactivated_by_rule=null: eine manuelle Admin-Entscheidung (in beide
  // Richtungen) hat Vorrang vor core.
  // reactivate_sufficiently_equipped_charge_points() -- ohne das Loeschen
  // wuerde ein spaeterer Reimport eine bewusst deaktivierte Station mit
  // (zufaellig) noch gesetztem Marker automatisch wieder aktivieren, siehe
  // Migration 20261024220000.
  const { error } = await supabase
    .schema("core")
    .from("charge_point")
    .update({ is_active: isActive, deactivated_by_rule: null })
    .eq("id", chargePointId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
  revalidatePath("/ladestationen");
}

export async function deleteChargingReview(reviewId: string, chargePointId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("charging_reviews").delete().eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ladestationen/${chargePointId}`);
}
