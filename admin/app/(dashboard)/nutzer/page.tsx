import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "nie";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = createServiceClient();

  // Supabase Admin API hat keine servergefilterte Suche -- fuer den
  // erwarteten Nutzerumfang dieser App (MVP-Testphase) reicht es, bis zu
  // 1000 Nutzer zu laden und clientseitig (hier: serverseitig im Request)
  // nach E-Mail zu filtern, statt eine eigene Such-Infrastruktur zu bauen.
  const [usersResult, profilesResult, usageEventsResult] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("profiles").select("id, is_admin"),
    // "Zuletzt aktiv" je Nutzer (juengstes app_usage_event) -- echte Nutzung
    // statt nur last_sign_in_at (reiner Login-Zeitpunkt, siehe nutzer/[id]/
    // page.tsx). Kein GROUP BY ueber Supabase-JS moeglich, deshalb absteigend
    // sortiert laden und je user_id nur den ersten (juengsten) Treffer
    // behalten -- bei der aktuellen MVP-Groessenordnung unproblematisch.
    supabase.schema("core").from("app_usage_event").select("user_id, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  // Ungeprueft sah ein fehlgeschlagener Request bisher exakt so aus wie
  // "0 Nutzer" (Audit-Befund 2026-09-22, gleiche Fehlerklasse wie im
  // Dashboard -- siehe admin/app/(dashboard)/page.tsx).
  const queryError = usersResult.error ?? profilesResult.error ?? usageEventsResult.error;
  if (queryError) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Nutzer</h1>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Liste konnte nicht geladen werden: {queryError.message}
        </p>
      </div>
    );
  }

  const { data } = usersResult;
  const isAdminById = new Map((profilesResult.data ?? []).map((p) => [p.id, p.is_admin]));
  const usageEvents = usageEventsResult.data;
  const lastActiveByUser = new Map<string, string>();
  for (const e of usageEvents ?? []) {
    if (e.user_id && !lastActiveByUser.has(e.user_id)) lastActiveByUser.set(e.user_id, e.created_at as string);
  }

  let users = data?.users ?? [];
  if (q) {
    const needle = q.toLowerCase();
    users = users.filter((u) => u.email?.toLowerCase().includes(needle));
  }
  users.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutzer</h1>
        <p className="text-sm text-text-muted">{users.length} gesamt</p>
      </div>

      <form className="flex gap-2" action="/nutzer">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="E-Mail suchen…"
          className="min-h-11 flex-1 rounded-md border border-line px-3 py-2 text-base"
        />
        <button type="submit" className="min-h-11 rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
          Suchen
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/nutzer/${u.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
          >
            <div>
              <p className="font-medium">{u.email}</p>
              <p className="text-text-muted">
                Zuletzt angemeldet: {formatDateTime(u.last_sign_in_at)} · Zuletzt aktiv:{" "}
                {formatDateTime(lastActiveByUser.get(u.id))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdminById.get(u.id) && <span className="rounded-full bg-route/10 px-2 py-0.5 text-xs text-route">Admin</span>}
              {u.banned_until && new Date(u.banned_until) > new Date() && (
                <span className="rounded-full bg-status-down/10 px-2 py-0.5 text-xs text-status-down">Gesperrt</span>
              )}
            </div>
          </Link>
        ))}
        {users.length === 0 && <p className="text-sm text-text-muted">Keine Treffer.</p>}
      </div>
    </div>
  );
}
