import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { CaravanModelForm } from "../../caravan-model-form";
import type { CaravanModel, CaravanModelSuggestion } from "@/lib/types";
import { approveCaravanModelSuggestion } from "../actions";

export default async function CaravanModelSuggestionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: suggestion } = await supabase
    .schema("enrich")
    .from("caravan_model_suggestion")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!suggestion || (suggestion as CaravanModelSuggestion).status !== "pending") notFound();
  const s = suggestion as CaravanModelSuggestion;

  const prefill = {
    manufacturer: s.manufacturer,
    model: s.model,
    series: "",
    length_m: s.length_m,
    width_m: s.width_m,
    height_m: s.height_m,
    source: "user_suggestion",
    verification_status: "unverified",
  } as unknown as CaravanModel;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/wohnwagenmodelle/vorschlaege" className="text-sm text-text-muted hover:underline">
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
        <p className="text-text-muted">Bitte Angaben unten prüfen (Nutzerangabe, ungeprüft), bevor der Katalogeintrag angelegt wird.</p>
      </div>

      <CaravanModelForm caravan={prefill} action={approveCaravanModelSuggestion.bind(null, s.id)} submitLabel="Als Modell übernehmen" />
    </div>
  );
}
