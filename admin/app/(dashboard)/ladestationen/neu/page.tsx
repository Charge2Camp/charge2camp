import Link from "next/link";
import { ChargePointForm } from "@/components/charge-point-form";
import { addChargePoint } from "./actions";

export default function NewChargePointPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/ladestationen" className="text-sm text-text-muted hover:underline">
          ← Ladestationen
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Ladestation manuell anlegen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Für Stationen, die bei Open Charge Map (noch) nicht gelistet sind. Landet mit{" "}
          <code className="rounded bg-line/40 px-1">source = &quot;admin_manual&quot;</code> in der Datenbank.
        </p>
      </div>
      <ChargePointForm action={addChargePoint} />
    </div>
  );
}
