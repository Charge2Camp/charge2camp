import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import type { CaravanModel } from "@/lib/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteCaravanModel, updateCaravanModel } from "../actions";
import { CaravanModelForm } from "../caravan-model-form";

export default async function CaravanModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase.from("caravan_models").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const caravan = data as CaravanModel;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/wohnwagenmodelle" className="text-sm text-text-muted hover:underline">
          ← Wohnwagenmodelle
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {caravan.manufacturer} {caravan.model}
        </h1>
      </div>

      <CaravanModelForm caravan={caravan} action={updateCaravanModel.bind(null, id)} submitLabel="Speichern" />

      <form action={deleteCaravanModel.bind(null, id)} className="border-t border-line pt-4">
        <ConfirmSubmitButton
          confirmText="Dieses Wohnwagenmodell wirklich aus dem Katalog löschen? Bereits gespeicherte Wohnwagen von Nutzern bleiben erhalten, verlieren nur den Verweis auf dieses Modell."
          className="min-h-11 text-sm font-medium text-status-down hover:underline"
        >
          Modell aus dem Katalog löschen
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
