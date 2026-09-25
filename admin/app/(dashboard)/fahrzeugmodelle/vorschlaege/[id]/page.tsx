import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { VehicleModelForm } from "../../vehicle-model-form";
import type { VehicleModel, VehicleModelSuggestion } from "@/lib/types";
import { approveVehicleModelSuggestion } from "../actions";

export default async function VehicleModelSuggestionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: suggestion } = await supabase
    .schema("enrich")
    .from("vehicle_model_suggestion")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!suggestion || (suggestion as VehicleModelSuggestion).status !== "pending") notFound();
  const s = suggestion as VehicleModelSuggestion;

  // VehicleModelForm erwartet ein volles VehicleModel (Bearbeiten-Formular)
  // -- fuer die Review-Vorbefuellung reichen die Felder, die die Form
  // tatsaechlich liest; "Variante" hat der Nutzer nicht angegeben (kein
  // Feld in vehicle-form.tsx) und bleibt bewusst leer, damit der Admin sie
  // ergaenzt.
  const prefill = {
    manufacturer: s.manufacturer,
    model: s.model,
    variant: "",
    battery_capacity_kwh: s.battery_capacity_kwh,
    consumption_kwh_per_100km: s.consumption_kwh_per_100km,
    charging_power_kw: s.charging_power_kw,
    range_km: s.range_km,
    max_towing_weight_braked_kg: s.max_towing_weight_braked_kg,
    length_m: s.length_m,
    source: "user_suggestion",
    verification_status: "unverified",
  } as unknown as VehicleModel;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/fahrzeugmodelle/vorschlaege" className="text-sm text-text-muted hover:underline">
          ← Modellvorschläge
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Vorschlag prüfen &amp; übernehmen</h1>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm">
        <p>
          Vorgeschlagen am {new Date(s.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        {s.notes && (
          <p>
            <span className="font-medium">Notiz:</span> {s.notes}
          </p>
        )}
        <p className="text-text-muted">
          Bitte Angaben unten prüfen (Nutzerangabe, ungeprüft) und die Variante ergänzen, bevor der Katalogeintrag
          angelegt wird.
        </p>
      </div>

      <VehicleModelForm model={prefill} action={approveVehicleModelSuggestion.bind(null, s.id)} submitLabel="Als Modell übernehmen" />
    </div>
  );
}
