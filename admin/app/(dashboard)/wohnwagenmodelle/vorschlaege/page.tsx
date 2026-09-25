import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import type { CaravanModelSuggestion } from "@/lib/types";
import { rejectCaravanModelSuggestion } from "./actions";

export default async function CaravanModelSuggestionsPage() {
  const supabase = createServiceClient();

  const [{ data: suggestions, error }, usersResult] = await Promise.all([
    supabase
      .schema("enrich")
      .from("caravan_model_suggestion")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/wohnwagenmodelle" className="text-sm text-text-muted hover:underline">
          ← Wohnwagenmodelle
        </Link>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Vorschläge konnten nicht geladen werden: {error.message}
        </p>
      </div>
    );
  }

  const pending = (suggestions ?? []) as CaravanModelSuggestion[];
  const emailByUserId = new Map((usersResult.data?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/wohnwagenmodelle" className="text-sm text-text-muted hover:underline">
          ← Wohnwagenmodelle
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Modellvorschläge von Nutzern</h1>
        <p className="mt-1 text-sm text-text-muted">
          Von Nutzern über &quot;Mein Gespann&quot; vorgeschlagene, bei uns fehlende Wohnwagenmodelle -- {pending.length}{" "}
          offen.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {pending.map((s) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-md border border-line bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {s.manufacturer} {s.model}
                </p>
                <p className="text-text-muted">
                  {emailByUserId.get(s.user_id) ?? s.user_id} ·{" "}
                  {new Date(s.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
            <p className="text-text-muted">
              {[
                s.length_m != null && `${s.length_m} m lang`,
                s.width_m != null && `${s.width_m} m breit`,
                s.height_m != null && `${s.height_m} m hoch`,
              ]
                .filter(Boolean)
                .join(" · ") || "Keine weiteren Maßangaben."}
            </p>
            <div className="flex gap-2">
              <Link
                href={`/wohnwagenmodelle/vorschlaege/${s.id}`}
                className="min-h-11 rounded-md bg-action px-3 py-2 text-sm font-medium leading-none hover:bg-action-hover"
              >
                Review starten
              </Link>
              <form action={rejectCaravanModelSuggestion.bind(null, s.id)}>
                <button
                  type="submit"
                  className="min-h-11 rounded-md border border-line px-3 py-2 text-sm font-medium leading-none hover:bg-line/20"
                >
                  Ablehnen
                </button>
              </form>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-sm text-text-muted">Keine offenen Vorschläge.</p>}
      </div>
    </div>
  );
}
