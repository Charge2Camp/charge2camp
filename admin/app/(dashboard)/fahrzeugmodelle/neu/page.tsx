import Link from "next/link";
import { addVehicleModel } from "../actions";
import { VehicleModelForm } from "../vehicle-model-form";

export default function NewVehicleModelPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/fahrzeugmodelle" className="text-sm text-text-muted hover:underline">
          ← Fahrzeugmodelle
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Neues Fahrzeugmodell</h1>
      </div>
      <VehicleModelForm action={addVehicleModel} submitLabel="Modell anlegen" />
    </div>
  );
}
