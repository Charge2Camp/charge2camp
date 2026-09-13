import Link from "next/link";
import { addCaravanModel } from "../actions";
import { CaravanModelForm } from "../caravan-model-form";

export default function NewCaravanModelPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/wohnwagenmodelle" className="text-sm text-text-muted hover:underline">
          ← Wohnwagenmodelle
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Neues Wohnwagenmodell</h1>
      </div>
      <CaravanModelForm action={addCaravanModel} submitLabel="Modell anlegen" />
    </div>
  );
}
