import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { ChargePoint, ChargingReview, TrailerSuitability } from "@/lib/types";
import { deleteChargingReview, overrideTrailerSuitability, setChargePointActive, updateChargePoint } from "./actions";

export default async function ChargePointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: station } = await supabase.schema("core").from("charge_point").select("*").eq("id", id).maybeSingle();
  if (!station) notFound();
  const s = station as ChargePoint;

  const [{ data: trailerRow }, { data: reviews }] = await Promise.all([
    supabase.schema("enrich").from("trailer_suitability").select("*").eq("charge_point_key", s.external_key).maybeSingle(),
    supabase.from("charging_reviews").select("*").eq("charging_station_id", id).order("created_at", { ascending: false }),
  ]);
  const trailer = trailerRow as TrailerSuitability | null;
  const stationReviews = (reviews ?? []) as ChargingReview[];

  const updateAction = updateChargePoint.bind(null, id);
  const overrideAction = overrideTrailerSuitability.bind(null, s.external_key);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{s.name ?? s.operator ?? "(ohne Namen)"}</h1>
          <p className="mt-1 text-sm text-text-muted">{s.external_key}</p>
        </div>
        <form action={setChargePointActive.bind(null, id, !s.is_active)}>
          <button
            type="submit"
            className={`min-h-11 whitespace-nowrap rounded-md border px-3 text-sm font-medium ${
              s.is_active
                ? "border-status-down text-status-down hover:bg-status-down/10"
                : "border-route text-route hover:bg-route/10"
            }`}
          >
            {s.is_active ? "Deaktivieren (unsichtbar machen)" : "Wieder aktivieren"}
          </button>
        </form>
      </div>

      {!s.is_active && (
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Diese Ladestation ist deaktiviert und in der App aktuell unsichtbar.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Stammdaten</h2>
        <form action={updateAction} className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input name="name" defaultValue={s.name ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Betreiber
            <input
              name="operator"
              defaultValue={s.operator ?? ""}
              className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Adresse
            <input
              name="address"
              defaultValue={s.address ?? ""}
              className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Stadt
              <input name="city" defaultValue={s.city ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Land (ISO2)
              <input
                name="country_code"
                defaultValue={s.country_code ?? ""}
                maxLength={2}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Zugang
              <select name="access_type" defaultValue={s.access_type ?? ""} className="min-h-11 rounded-md border border-line px-3 py-2 text-base">
                <option value="">Unbekannt</option>
                <option value="public">Öffentlich</option>
                <option value="restricted">Eingeschränkt</option>
                <option value="private">Privat</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Max. Leistung (kW)
              <input
                type="number"
                step="0.1"
                name="max_power_kw"
                defaultValue={s.max_power_kw ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="is_operational" value="1" defaultChecked={s.is_operational ?? true} />
            Laut Quelle betriebsbereit
          </label>
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Anhängertauglichkeit (manuelle Korrektur)</h2>
        <p className="mt-1 text-sm text-text-muted">
          Überschreibt die community-basierte Einschätzung direkt. Aktuell: {trailer?.verdict ?? "ungeprüft"}
          {trailer?.origin ? ` (Quelle: ${trailer.origin})` : ""}.
        </p>
        <form action={overrideAction} className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Einstufung
            <select name="verdict" defaultValue={trailer?.verdict ?? "unknown"} className="min-h-11 rounded-md border border-line px-3 py-2 text-base">
              <option value="yes">Anhängertauglich</option>
              <option value="unhitch">Nur abgekoppelt erreichbar</option>
              <option value="no">Nicht anhängertauglich</option>
              <option value="unknown">Ungeprüft</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="drive_through" value="1" defaultChecked={trailer?.drive_through ?? false} />
            Drive-Through (durchfahrbar, kein Rangieren nötig)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Rangierfläche
              <select
                name="maneuvering_space"
                defaultValue={trailer?.maneuvering_space ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              >
                <option value="">Unbekannt</option>
                <option value="ample">Ausreichend</option>
                <option value="tight">Eng</option>
                <option value="none">Keine</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Einfahrlänge (m)
              <input
                type="number"
                step="0.1"
                name="pull_in_length_m"
                defaultValue={trailer?.pull_in_length_m ?? ""}
                className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Notizen
            <textarea
              name="notes"
              defaultValue={trailer?.notes ?? ""}
              rows={3}
              className="rounded-md border border-line px-3 py-2 text-base"
            />
          </label>
          <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
            Anhängertauglichkeit speichern
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Bewertungen ({stationReviews.length})</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {stationReviews.map((review) => (
            <li key={review.id} className="flex items-start justify-between gap-3 rounded-md border border-line p-3 text-sm">
              <div>
                <p className="font-medium">{review.suitable}</p>
                {review.comment && <p className="text-text-muted">{review.comment}</p>}
              </div>
              <form action={deleteChargingReview.bind(null, review.id, id)}>
                <button type="submit" className="text-xs text-status-down hover:underline">
                  Löschen
                </button>
              </form>
            </li>
          ))}
          {stationReviews.length === 0 && <p className="text-sm text-text-muted">Keine Bewertungen.</p>}
        </ul>
      </section>
    </div>
  );
}
