import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { Amenity, Campsite, CampsiteAmenity, CampsiteCharging, CampsiteReview } from "@/lib/types";
import {
  deleteCampsiteReview,
  overrideCampsiteCharging,
  overrideEvScore,
  setCampsiteActive,
  updateAmenities,
  updateCampsite,
} from "./actions";

const CHARGING_TYPE_LABELS: Record<string, string> = {
  wallbox: "Wallbox",
  schuko_only: "nur Schuko-Steckdose",
  dc_fast: "DC-Schnelllader",
  cee: "CEE (Camping-Steckdose)",
  mixed: "gemischt",
};

const CATEGORY_LABELS: Record<string, string> = {
  lage: "Lage",
  wasser: "Wasser & Pool",
  familie: "Familie",
  infra: "Infrastruktur",
  stellplatz: "Stellplatz",
  laden: "Elektromobilität",
  sonstig: "Sonstiges",
};

export default async function CampsiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: campsite } = await supabase.schema("core").from("campsite").select("*").eq("id", id).maybeSingle();
  if (!campsite) notFound();
  const c = campsite as Campsite;

  const [{ data: amenityCatalog }, { data: campsiteAmenities }, { data: reviews }, { data: charging }, { data: geoRow }] =
    await Promise.all([
      supabase.schema("core").from("amenity").select("*").eq("value_type", "bool").order("category").order("label_de"),
      supabase.schema("core").from("campsite_amenity").select("*").eq("campsite_id", id),
      supabase.from("campsite_reviews").select("*").eq("campsite_id", id).order("created_at", { ascending: false }),
      supabase.schema("enrich").from("campsite_charging").select("*").eq("campsite_key", c.external_key).maybeSingle(),
      // core.campsite_geo_admin: lat/lon, ohne is_active-Filter (siehe
      // ladestationen/[id]/page.tsx, gleiches Muster).
      supabase.schema("core").from("campsite_geo_admin").select("lat, lon").eq("id", id).maybeSingle(),
    ]);
  const amenities = (amenityCatalog ?? []) as Amenity[];
  const activeAmenityKeys = new Set(
    ((campsiteAmenities ?? []) as CampsiteAmenity[]).filter((a) => a.value_bool).map((a) => a.amenity_key)
  );
  const campsiteReviews = (reviews ?? []) as CampsiteReview[];
  const chargingInfo = charging as CampsiteCharging | null;
  const geo = geoRow as { lat: number; lon: number } | null;

  const groups = new Map<string, Amenity[]>();
  for (const amenity of amenities) {
    const list = groups.get(amenity.category) ?? [];
    list.push(amenity);
    groups.set(amenity.category, list);
  }

  const updateAction = updateCampsite.bind(null, id);
  const amenitiesAction = updateAmenities.bind(null, id, amenities.map((a) => a.key));
  const chargingAction = overrideCampsiteCharging.bind(null, id, c.external_key);
  const evScoreAction = overrideEvScore.bind(null, id);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <p className="mt-1 text-sm text-text-muted">{c.external_key}</p>
        </div>
        <form action={setCampsiteActive.bind(null, id, !c.is_active)}>
          <button
            type="submit"
            className={`min-h-11 whitespace-nowrap rounded-md border px-3 text-sm font-medium ${
              c.is_active
                ? "border-status-down text-status-down hover:bg-status-down/10"
                : "border-route text-route hover:bg-route/10"
            }`}
          >
            {c.is_active ? "Deaktivieren (unsichtbar machen)" : "Wieder aktivieren"}
          </button>
        </form>
      </div>

      {!c.is_active && (
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Dieser Campingplatz ist deaktiviert und in der App aktuell unsichtbar.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Stammdaten</h2>
        <form action={updateAction} className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" required defaultValue={c.name} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Adresse
            <input
              name="address"
              defaultValue={c.address ?? ""}
              className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Stadt
              <input name="city" defaultValue={c.city ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Land (ISO2)
              <input
                name="country_code"
                defaultValue={c.country_code ?? ""}
                maxLength={2}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Breitengrad (Latitude)
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                name="latitude"
                defaultValue={geo?.lat ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Längengrad (Longitude)
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                name="longitude"
                defaultValue={geo?.lon ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Website
            <input name="website" defaultValue={c.website ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Telefon
              <input name="phone" defaultValue={c.phone ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              E-Mail
              <input name="email" defaultValue={c.email ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Kapazität (Stellplätze)
            <input
              type="number"
              name="capacity"
              defaultValue={c.capacity ?? ""}
              className="min-h-11 w-40 rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">EV-Camping-Score</h2>
        <p className="mt-1 text-sm text-text-muted">
          Standardmäßig automatisch berechnet (Ladeinfos, Schnelllader-Nähe, Bewertungen, Aktualität). Ein
          gesetzter Wert überschreibt die Berechnung direkt; leeres Feld = wieder automatisch berechnen.
        </p>
        <form action={evScoreAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            Score (0-100, leer = automatisch)
            <input
              type="number"
              name="ev_score_override"
              min={0}
              max={100}
              step={1}
              defaultValue={c.ev_score_override ?? ""}
              className="min-h-11 w-40 rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Ladeinfos auf dem Gelände</h2>
        <p className="mt-1 text-sm text-text-muted">
          Überschreibt die automatisch aus OSM-Daten abgeleitete Einschätzung (z. B. wenn ein Ladepunkt ohne
          eigenen OSM-Eintrag existiert oder die Anzahl nicht stimmt).
        </p>
        <form action={chargingAction} className="mt-3 flex flex-col gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="has_charging" value="1" defaultChecked={chargingInfo?.has_charging ?? false} />
            Laden auf dem Platz möglich
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="pitch_charging" value="1" defaultChecked={chargingInfo?.pitch_charging ?? false} />
            Laden direkt am Stellplatz
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Max. Ladeleistung (kW)
              <input
                type="number"
                name="max_power_kw"
                step="0.1"
                min="0"
                defaultValue={chargingInfo?.max_power_kw ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Anzahl Ladepunkte
              <input
                type="number"
                name="point_count"
                min="0"
                step="1"
                defaultValue={chargingInfo?.point_count ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Ladeart
            <select
              name="charging_type"
              defaultValue={chargingInfo?.charging_type ?? ""}
              className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
            >
              <option value="">Unbekannt</option>
              {Object.entries(CHARGING_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Ladeinfos speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Merkmale</h2>
        <form action={amenitiesAction} className="mt-3 flex flex-col gap-5">
          {Array.from(groups.entries()).map(([category, categoryAmenities]) => (
            <fieldset key={category} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{CATEGORY_LABELS[category] ?? category}</legend>
              {categoryAmenities.map((amenity) => (
                <label key={amenity.key} className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name={amenity.key} value="1" defaultChecked={activeAmenityKeys.has(amenity.key)} />
                  {amenity.label_de}
                </label>
              ))}
            </fieldset>
          ))}
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Merkmale speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Bewertungen ({campsiteReviews.length})</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {campsiteReviews.map((review) => (
            <li key={review.id} className="flex items-start justify-between gap-3 rounded-md border border-line p-3 text-sm">
              <div>
                <p className="font-medium">{review.rating} / 5</p>
                {review.comment && <p className="text-text-muted">{review.comment}</p>}
              </div>
              <form action={deleteCampsiteReview.bind(null, review.id, id)}>
                <button type="submit" className="text-xs text-status-down hover:underline">
                  Löschen
                </button>
              </form>
            </li>
          ))}
          {campsiteReviews.length === 0 && <p className="text-sm text-text-muted">Keine Bewertungen.</p>}
        </ul>
      </section>
    </div>
  );
}
