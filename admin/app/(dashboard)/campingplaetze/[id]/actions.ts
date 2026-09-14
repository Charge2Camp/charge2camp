"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

export async function updateCampsite(campsiteId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    name: formData.get("name") as string,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || null,
    country_code: (formData.get("country_code") as string) || null,
    website: (formData.get("website") as string) || null,
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
    updated_at: new Date().toISOString(),
  };

  // Koordinaten-Korrektur (Auslöser: "Unplausible Koordinaten"), gleiches
  // Muster wie ladestationen/[id]/actions.ts updateChargePoint.
  const latRaw = formData.get("latitude");
  const lonRaw = formData.get("longitude");
  if (typeof latRaw === "string" && latRaw.trim() && typeof lonRaw === "string" && lonRaw.trim()) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Ungültiger Breitengrad.");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error("Ungültiger Längengrad.");
    update.geom = `SRID=4326;POINT(${lon} ${lat})`;
  }

  const { error } = await supabase.schema("core").from("campsite").update(update).eq("id", campsiteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}

/** Manuelle Korrektur der Ladeinfos auf dem Campingplatz-Gelaende selbst --
 * core.campsite_search (Lesesicht der Haupt-App) uebernimmt "Anzahl
 * Ladepunkte" bisher NUR aus der OSM-abgeleiteten Verknuepfung (core.
 * campsite_charge_link), die nicht jeden real existierenden Ladepunkt
 * erfasst (z. B. ohne eigenen OSM-Node). enrich.campsite_charging.
 * point_count (und has_charging/max_power_kw) ueberschreiben das jetzt,
 * siehe core.campsite_search Migration 20260919000000 und
 * src/app/campingplaetze/[id]/page.tsx (numberOfChargingPoints).
 *
 * campsite_key ist der externe Schluessel (core.campsite.external_key),
 * NICHT die UUID -- enrich.campsite_charging ist absichtlich von core.*
 * entkoppelt (eigenes Recherche-Schema, siehe docs/architecture.md). */
export async function overrideCampsiteCharging(campsiteId: string, campsiteKey: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("enrich").from("campsite_charging").upsert(
    {
      campsite_key: campsiteKey,
      has_charging: formData.get("has_charging") === "1",
      charging_type: (formData.get("charging_type") as string) || null,
      max_power_kw: formData.get("max_power_kw") ? Number(formData.get("max_power_kw")) : null,
      point_count: formData.get("point_count") ? Number(formData.get("point_count")) : null,
      pitch_charging: formData.get("pitch_charging") === "1",
      origin: "admin_override",
      checked_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campsite_key" }
  );

  if (error) throw new Error(error.message);

  // core.campsite_search ist eine MATERIALIZED VIEW -- ohne Refresh wirkt
  // sich die Korrektur nicht sofort in der Haupt-App aus (siehe
  // setCampsiteActive unten).
  const { error: refreshError } = await supabase.schema("core").rpc("refresh_campsite_search");
  if (refreshError) throw new Error(refreshError.message);

  revalidatePath(`/campingplaetze/${campsiteId}`);
}

/** EIN Formular fuer alle Merkmal-Checkboxen statt eines pro Merkmal --
 * `amenityKeys` sind die auf der Seite tatsaechlich angezeigten Checkboxen
 * (nur value_type="bool"), jede wird auf den aktuellen Haekchen-Zustand
 * gesetzt (auch "aus", falls vorher "an" war). */
export async function updateAmenities(campsiteId: string, amenityKeys: string[], formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const rows = amenityKeys.map((key) => ({
    campsite_id: campsiteId,
    amenity_key: key,
    value_bool: formData.get(key) === "1",
    source: "admin",
    confidence: 100,
  }));

  const { error } = await supabase.schema("core").from("campsite_amenity").upsert(rows, { onConflict: "campsite_id,amenity_key" });

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}

/** core.campsite_search (Quelle der Haupt-App-Liste/Suche/Karte) ist eine
 * MATERIALIZED VIEW -- anders als bei Ladestationen (einfache VIEW) wirkt
 * eine is_active-Aenderung an core.campsite deshalb NICHT sofort. Die RPC
 * core.refresh_campsite_search() (siehe Migration
 * 20260909020000_campsite_charge_point_active_flag.sql) stoesst den
 * Refresh CONCURRENTLY an -- unkritisch bei der Groesse dieser Tabelle. */
export async function setCampsiteActive(campsiteId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase.schema("core").from("campsite").update({ is_active: isActive }).eq("id", campsiteId);
  if (error) throw new Error(error.message);

  const { error: refreshError } = await supabase.schema("core").rpc("refresh_campsite_search");
  if (refreshError) throw new Error(refreshError.message);

  revalidatePath(`/campingplaetze/${campsiteId}`);
  revalidatePath("/campingplaetze");
}

/** Manueller Override des EV-Camping-Scores (Nutzerwunsch) -- leeres Feld
 * setzt ev_score_override auf NULL zurueck, wodurch die Haupt-App wieder
 * automatisch berechnet (siehe CoreCampsite.ev_score_override /
 * EvScoreBadge in der Haupt-App). core.campsite wird von der Detailseite
 * dort DIREKT gelesen (nicht ueber campsite_search), deshalb reicht ein
 * einfaches UPDATE ohne Materialized-View-Refresh. */
export async function overrideEvScore(campsiteId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createServiceClient();

  const raw = (formData.get("ev_score_override") as string) ?? "";
  const value = raw.trim() === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    throw new Error("EV-Score muss zwischen 0 und 100 liegen (oder leer für automatische Berechnung).");
  }

  const { error } = await supabase
    .schema("core")
    .from("campsite")
    .update({ ev_score_override: value, updated_at: new Date().toISOString() })
    .eq("id", campsiteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}

export async function deleteCampsiteReview(reviewId: string, campsiteId: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("campsite_reviews").delete().eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath(`/campingplaetze/${campsiteId}`);
}
