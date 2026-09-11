"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";
import { deriveCampsiteRating } from "@/lib/scoring/ev-camping-score";
import { sanitizeProviderKeys } from "@/lib/charging-providers";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireNumber(value: FormDataEntryValue | null): number {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) throw new Error("Pflichtfeld fehlt oder ist keine Zahl.");
  return parsed;
}

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function requireString(value: FormDataEntryValue | null): string {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error("Pflichtfeld fehlt.");
  }
  return value.trim();
}

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  return { supabase, userId: user.id };
}

export async function addVehicle(formData: FormData) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("vehicles").insert({
    user_id: userId,
    manufacturer: requireString(formData.get("manufacturer")),
    model: requireString(formData.get("model")),
    battery_capacity_kwh: requireNumber(formData.get("battery_capacity_kwh")),
    consumption_kwh_per_100km: parseOptionalNumber(formData.get("consumption_kwh_per_100km")),
    charging_power_kw: parseOptionalNumber(formData.get("charging_power_kw")),
    range_km: parseOptionalNumber(formData.get("range_km")),
    max_towing_weight_braked_kg: parseOptionalNumber(formData.get("max_towing_weight_braked_kg")),
    length_m: parseOptionalNumber(formData.get("length_m")),
    width_m: parseOptionalNumber(formData.get("width_m")),
    height_m: parseOptionalNumber(formData.get("height_m")),
    weight_kg: parseOptionalNumber(formData.get("weight_kg")),
    model_reference_id: formData.get("model_reference_id") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/gespann");
}

export async function deleteVehicle(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));

  const { error } = await supabase.from("vehicles").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/gespann");
}

export async function addCaravan(formData: FormData) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase.from("caravans").insert({
    user_id: userId,
    manufacturer: requireString(formData.get("manufacturer")),
    model: requireString(formData.get("model")),
    length_m: requireNumber(formData.get("length_m")),
    width_m: requireNumber(formData.get("width_m")),
    height_m: requireNumber(formData.get("height_m")),
    weight_kg: requireNumber(formData.get("weight_kg")),
    gross_vehicle_weight_kg: parseOptionalNumber(formData.get("gross_vehicle_weight_kg")),
    actual_travel_weight_kg: parseOptionalNumber(formData.get("actual_travel_weight_kg")),
    model_reference_id: formData.get("model_reference_id") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/gespann");
}

/** Setzt das Standard-Gespann im Profil (Box "Mein Gespann" oben auf
 * profil/gespann, Nutzerwunsch) -- der Routenplaner belegt Elektroauto-/
 * Wohnwagen-Auswahl damit vor, statt wie zuvor nur ueber die zuletzt
 * gespeicherte Route zu raten. Leerer String setzt das jeweilige Feld
 * zurueck (kein Fahrzeug/Wohnwagen als Standard). */
export async function setDefaultGespann(vehicleId: string, caravanId: string) {
  const { supabase, userId } = await requireUserId();

  const { error } = await supabase
    .from("profiles")
    .update({
      default_vehicle_id: vehicleId || null,
      default_caravan_id: caravanId || null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil/gespann");
  revalidatePath("/routenplaner");
}

export async function deleteCaravan(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));

  const { error } = await supabase.from("caravans").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/gespann");
}

export async function updateCampsiteReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const campsiteId = formData.get("campsite_id");
  const chargingOnSite = parseOptionalBoolean(formData.get("charging_on_site"));
  const chargingWalkable = parseOptionalBoolean(formData.get("charging_walkable"));
  const comment = formData.get("comment");

  if (chargingOnSite === null) throw new Error("Bitte angeben, ob Laden auf dem Platz möglich ist.");
  if (chargingWalkable === null) throw new Error("Bitte angeben, ob eine nutzbare Ladelösung fußläufig erreichbar ist.");

  const { error } = await supabase
    .from("campsite_reviews")
    .update({
      rating: deriveCampsiteRating(chargingOnSite, chargingWalkable),
      charging_on_site: chargingOnSite,
      charging_walkable: chargingWalkable,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/bewertungen");
  if (typeof campsiteId === "string" && campsiteId) revalidatePath(`/campingplaetze/${campsiteId}`);
}

export async function deleteCampsiteReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const campsiteId = formData.get("campsite_id");

  const { error } = await supabase
    .from("campsite_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/bewertungen");
  if (typeof campsiteId === "string" && campsiteId) revalidatePath(`/campingplaetze/${campsiteId}`);
}

export async function updateChargingReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const stationId = formData.get("charging_station_id");
  const suitable = formData.get("suitable");
  const comment = formData.get("comment");
  const caravanModel = formData.get("caravan_model");

  if (suitable !== "yes" && suitable !== "no" && suitable !== "limited") {
    throw new Error("Bitte eine gültige Antwort auswählen.");
  }

  const decoupledParkingRaw = formData.get("decoupled_parking_possible");
  const decoupledParkingPossible =
    suitable === "limited"
      ? decoupledParkingRaw === "yes"
        ? true
        : decoupledParkingRaw === "no"
          ? false
          : null
      : null;

  const { error } = await supabase
    .from("charging_reviews")
    .update({
      suitable,
      decoupled_parking_possible: decoupledParkingPossible,
      enough_space_for_rig: parseOptionalBoolean(formData.get("enough_space_for_rig")),
      unobstructed_access: parseOptionalBoolean(formData.get("unobstructed_access")),
      no_barrier_or_garage: parseOptionalBoolean(formData.get("no_barrier_or_garage")),
      side_mounted_charger: parseOptionalBoolean(formData.get("side_mounted_charger")),
      trailer_length_m: parseOptionalNumber(formData.get("trailer_length_m")),
      trailer_width_m: parseOptionalNumber(formData.get("trailer_width_m")),
      caravan_model:
        typeof caravanModel === "string" && caravanModel.trim() ? caravanModel.trim() : null,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/bewertungen");
  if (typeof stationId === "string" && stationId) revalidatePath(`/ladepunkte/${stationId}`);
}

export async function deleteChargingReview(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));
  const stationId = formData.get("charging_station_id");

  const { error } = await supabase
    .from("charging_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/bewertungen");
  if (typeof stationId === "string" && stationId) revalidatePath(`/ladepunkte/${stationId}`);
}

export async function deleteSavedRoute(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = requireString(formData.get("id"));

  const { error } = await supabase.from("saved_routes").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil");
  revalidatePath("/profil/routen");
}

/** Speichert die Zuhause-Adresse im Profil -- einmalig per Nominatim
 * geocodiert (kein Autocomplete-Aufruf, siehe docs/data-sources.md), damit
 * der Routenplaner sie spaeter direkt als Start/Ziel uebernehmen kann, ohne
 * bei jeder Routenplanung erneut zu geocodieren. Leeres Feld entfernt die
 * hinterlegte Adresse wieder. */
export async function setHomeAddress(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const addressRaw = formData.get("home_address");
  const address = typeof addressRaw === "string" ? addressRaw.trim() : "";

  if (!address) {
    const { error } = await supabase
      .from("profiles")
      .update({ home_address: null, home_latitude: null, home_longitude: null })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/profil/daten");
    revalidatePath("/routenplaner");
    return;
  }

  // Wurde die Adresse ueber einen Vorschlag ausgewaehlt (siehe
  // AddressAutocomplete `onSelectCoordinates` in home-address-form.tsx),
  // sind Koordinaten UND die praezise formatierte Adresse (inkl. Hausnummer)
  // schon bekannt -- kein erneutes Geocoding, das die Hausnummer je nach
  // OSM-Datenlage bei Nominatim abweichend formatieren oder weglassen
  // koennte.
  const latitudeRaw = formData.get("home_latitude");
  const longitudeRaw = formData.get("home_longitude");
  const coordsFromSuggestion =
    typeof latitudeRaw === "string" && typeof longitudeRaw === "string" && latitudeRaw !== "" && longitudeRaw !== ""
      ? { latitude: Number(latitudeRaw), longitude: Number(longitudeRaw) }
      : null;

  const resolved = coordsFromSuggestion
    ? { displayName: address, ...coordsFromSuggestion }
    : await geocodeAddress(address);
  if (!resolved) throw new Error(`Adresse "${address}" konnte nicht gefunden werden.`);

  const { error } = await supabase
    .from("profiles")
    .update({
      home_address: resolved.displayName,
      home_latitude: resolved.latitude,
      home_longitude: resolved.longitude,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil/daten");
  revalidatePath("/routenplaner");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stoesst den Supabase-eigenen E-Mail-Aenderungsablauf an: je nach
 * Projekteinstellung (`mailer_secure_email_change_enabled`) muss der
 * Nutzer den Wechsel per Bestaetigungslink in der neuen (und ggf. alten)
 * Mailbox bestaetigen, bevor `auth.users.email` sich tatsaechlich aendert
 * -- dieser Server Action loest nur den Versand aus, nicht die Aenderung
 * selbst. `profiles.email` wird bewusst NICHT hier mitgeschrieben (waere
 * vor der Bestaetigung eine falsche Angabe); die Seite zeigt ohnehin
 * `auth.getUser().email`, nicht die profiles-Spalte. */
export async function changeEmail(formData: FormData) {
  const { supabase } = await requireUserId();
  const newEmail = requireString(formData.get("email")).toLowerCase();
  if (!EMAIL_PATTERN.test(newEmail)) throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw new Error(error.message);
  revalidatePath("/profil/daten");
}

/** Loescht das Konto unwiderruflich. Nutzt den Admin-/Service-Role-Client
 * (admin.auth.admin.deleteUser), weil eine normale Nutzer-Session ihr
 * eigenes auth.users-Konto nicht selbst loeschen darf. Kaskadiert per FK
 * (`on delete cascade`) auf profiles/vehicles/caravans/favorites/
 * Bewertungen/gespeicherte Routen -- siehe docs/privacy.md. */
export async function deleteAccount() {
  const { supabase, userId } = await requireUserId();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  await supabase.auth.signOut();
  redirect("/");
}

/** Passwort aendern -- verlangt bewusst das aktuelle Passwort (per
 * erneutem signInWithPassword geprueft), bevor auth.updateUser das neue
 * setzt. `updateUser` allein wuerde jede bestehende Session akzeptieren,
 * ohne das aktuelle Passwort zu kennen -- bei einem uebernommenen/liegen
 * gelassenen Geraet koennte sonst jemand ohne Passwortkenntnis das Konto
 * komplett uebernehmen. */
export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

/** Ein falsches aktuelles Passwort ist hier -- anders als z. B. bei
 * deleteVehicle -- ein alltaeglicher, erwarteter Fall (Tippfehler), keine
 * Ausnahme. Deshalb bewusst KEIN throw (Next.js zeigt dafuer nur eine
 * generische "Serverfehler"-Seite, siehe change-password-form.tsx) --
 * stattdessen ein Ergebnisobjekt fuer useActionState, damit der Fehler
 * inline im Formular erscheint. */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const { supabase } = await requireUserId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Nicht angemeldet." };

  const currentPassword = requireString(formData.get("current_password"));
  const newPassword = requireString(formData.get("new_password"));
  const newPasswordConfirm = requireString(formData.get("new_password_confirm"));

  if (newPassword !== newPasswordConfirm) {
    return { error: "Die beiden neuen Passwörter stimmen nicht überein." };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) return { error: "Aktuelles Passwort ist falsch." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  revalidatePath("/profil/daten");
  return { success: true };
}

/** Speichert die bevorzugten Lade-Anbieter im Profil (Nutzerwunsch, "Mein
 * Gespann" ganz unten) -- feste Auswahl aus den zehn groessten/
 * verbreitetsten Anbietern (siehe charging-providers.ts), per Checkbox.
 * Dient dem Routenplaner als Standardauswahl fuer den dortigen
 * Anbieter-Filter (route-planner-form.tsx). */
export async function setPreferredChargingProviders(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const providers = sanitizeProviderKeys(
    formData.getAll("preferred_providers").filter((v): v is string => typeof v === "string")
  );

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_charging_providers: providers })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/profil/gespann");
  revalidatePath("/routenplaner");
}
