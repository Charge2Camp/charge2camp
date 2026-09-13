import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { VehicleModel } from "@/lib/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteVehicleModel, updateVehicleModel } from "../actions";
import { VehicleModelForm } from "../vehicle-model-form";

export default async function VehicleModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase.from("vehicle_models").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const model = data as VehicleModel;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/fahrzeugmodelle" className="text-sm text-text-muted hover:underline">
          ← Fahrzeugmodelle
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {model.manufacturer} {model.model} {model.variant}
        </h1>
      </div>

      <VehicleModelForm model={model} action={updateVehicleModel.bind(null, id)} submitLabel="Speichern" />

      <form action={deleteVehicleModel.bind(null, id)} className="border-t border-line pt-4">
        <ConfirmSubmitButton
          confirmText="Dieses Fahrzeugmodell wirklich aus dem Katalog löschen? Bereits gespeicherte Fahrzeuge von Nutzern bleiben erhalten, verlieren nur den Verweis auf dieses Modell."
          className="min-h-11 text-sm font-medium text-status-down hover:underline"
        >
          Modell aus dem Katalog löschen
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
