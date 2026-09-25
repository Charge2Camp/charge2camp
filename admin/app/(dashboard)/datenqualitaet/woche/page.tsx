import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Wochenstart = letzter Montag 00:00 (lokale Serverzeit reicht hier --
 * keine Abrechnungs-/Rechtsrelevanz, nur eine Uebersicht). Ausgelagert statt
 * Date.now() direkt im Component-Body, siehe gleiches Muster in
 * (dashboard)/page.tsx daysAgoIso(). */
function startOfWeekIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sonntag
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getTime() - diffToMonday * DAY_MS);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

interface ChargePointRow {
  id: string;
  external_key: string;
  name: string | null;
  operator: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  source_updated_at: string | null;
  source: string;
  manual_override: boolean;
}

interface CampsiteRow {
  id: string;
  external_key: string;
  name: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

interface VehicleModelRow {
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  created_at: string;
}

interface CaravanModelRow {
  id: string;
  manufacturer: string;
  model: string;
  series: string | null;
  created_at: string;
}

interface VehicleModelSuggestionRow {
  id: number;
  manufacturer: string;
  model: string;
  created_at: string;
}

interface CaravanModelSuggestionRow {
  id: number;
  manufacturer: string;
  model: string;
  created_at: string;
}

export default async function WeeklyChangesPage() {
  const supabase = createServiceClient();
  const weekStart = startOfWeekIso();

  const [
    { data: newChargePoints, error: newCpError },
    { data: changedChargePointsRaw, error: changedCpError },
    { data: newCampsites, error: newCsError },
    { data: changedCampsites, error: changedCsError },
    usersResult,
    { data: newVehicleModels, error: newVmError },
    { data: newCaravanModels, error: newCmError },
    { data: pendingVehicleSuggestions, error: pendingVsError },
    { data: pendingCaravanSuggestions, error: pendingCsSuggError },
  ] = await Promise.all([
    supabase
      .schema("core")
      .from("charge_point")
      .select("id, external_key, name, operator, city, created_at, updated_at, source_updated_at, source, manual_override")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false }),
    // Neue Datensaetze separat ausschliessen (unten per created_at<weekStart
    // gefiltert) -- sonst waere eine neue Station in beiden Listen. Zwei
    // getrennte Bedingungen statt einer gemeinsamen Query, weil Supabase-JS
    // kein "OR mit AND-Gruppen" bequem als Filter-Objekt abbildet.
    supabase
      .schema("core")
      .from("charge_point")
      .select("id, external_key, name, operator, city, created_at, updated_at, source_updated_at, source, manual_override")
      .lt("created_at", weekStart)
      .or(`and(source.eq.ocm,source_updated_at.gte.${weekStart}),and(source.neq.ocm,updated_at.gte.${weekStart}),and(manual_override.eq.true,updated_at.gte.${weekStart})`)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .schema("core")
      .from("campsite")
      .select("id, external_key, name, city, created_at, updated_at")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false }),
    supabase
      .schema("core")
      .from("campsite")
      .select("id, external_key, name, city, created_at, updated_at")
      .lt("created_at", weekStart)
      .gte("updated_at", weekStart)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    // Neue Referenzkatalog-Eintraege diese Woche (manuell von Admins
    // angelegt oder aus Vorschlaegen unten uebernommen) -- Nutzerwunsch:
    // woechentlicher Ueberblick "gibt es neue Modelle/Akku-Versionen, die
    // uns fehlen" (siehe Migration 20261025060000 fuer die Begruendung,
    // warum das kein automatischer externer Abgleich ist).
    supabase
      .from("vehicle_models")
      .select("id, manufacturer, model, variant, created_at")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false }),
    supabase
      .from("caravan_models")
      .select("id, manufacturer, model, series, created_at")
      .gte("created_at", weekStart)
      .order("created_at", { ascending: false }),
    // Offene Nutzer-Vorschlaege bewusst NICHT auf diese Woche eingegrenzt
    // (anders als oben) -- die Warteschlange soll immer vollstaendig
    // sichtbar sein, unabhaengig davon, wann ein Vorschlag eingegangen ist.
    supabase
      .schema("enrich")
      .from("vehicle_model_suggestion")
      .select("id, manufacturer, model, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .schema("enrich")
      .from("caravan_model_suggestion")
      .select("id, manufacturer, model, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const errors = [
    newCpError,
    changedCpError,
    newCsError,
    changedCsError,
    usersResult.error,
    newVmError,
    newCmError,
    pendingVsError,
    pendingCsSuggError,
  ].filter(Boolean);
  if (errors.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          Daten konnten nicht geladen werden: {errors.map((e) => e?.message).join(" / ")}
        </p>
      </div>
    );
  }

  const newChargePointRows = (newChargePoints ?? []) as ChargePointRow[];
  const changedChargePointRows = (changedChargePointsRaw ?? []) as ChargePointRow[];
  const newCampsiteRows = (newCampsites ?? []) as CampsiteRow[];
  const changedCampsiteRows = (changedCampsites ?? []) as CampsiteRow[];
  const newUsers = (usersResult.data?.users ?? []).filter((u) => u.created_at >= weekStart);
  const newVehicleModelRows = (newVehicleModels ?? []) as VehicleModelRow[];
  const newCaravanModelRows = (newCaravanModels ?? []) as CaravanModelRow[];
  const pendingVehicleSuggestionRows = (pendingVehicleSuggestions ?? []) as VehicleModelSuggestionRow[];
  const pendingCaravanSuggestionRows = (pendingCaravanSuggestions ?? []) as CaravanModelSuggestionRow[];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Neu & geändert diese Woche</h1>
        <p className="mt-1 text-sm text-text-muted">
          Seit Montag, {new Date(weekStart).toLocaleDateString("de-DE", { dateStyle: "medium" })}. &quot;Geändert&quot;
          markiert nur, DASS sich ein Datensatz seitdem verändert hat (bei Ladepunkten aus OCM anhand des von der Quelle
          gelieferten Aktualisierungsdatums, nicht anhand jedes Reimport-Laufs) -- welches Feld genau, siehst du auf
          der jeweiligen Detailseite.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Neue Ladepunkte ({newChargePointRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {newChargePointRows.map((s) => (
            <Link
              key={s.id}
              href={`/ladestationen/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <div>
                <p className="font-medium">{s.name ?? s.operator ?? s.external_key}</p>
                <p className="text-text-muted">{[s.city, s.operator].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {newChargePointRows.length === 0 && <p className="text-sm text-text-muted">Keine neuen Ladepunkte diese Woche.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Geänderte Ladepunkte ({changedChargePointRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {changedChargePointRows.map((s) => (
            <Link
              key={s.id}
              href={`/ladestationen/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <div>
                <p className="font-medium">{s.name ?? s.operator ?? s.external_key}</p>
                <p className="text-text-muted">{[s.city, s.operator].filter(Boolean).join(" · ")}</p>
              </div>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.source === "ocm" && !s.manual_override ? s.source_updated_at ?? s.updated_at : s.updated_at).toLocaleDateString(
                  "de-DE",
                  { dateStyle: "medium" }
                )}
              </p>
            </Link>
          ))}
          {changedChargePointRows.length === 0 && <p className="text-sm text-text-muted">Keine geänderten Ladepunkte diese Woche.</p>}
          {changedChargePointRows.length === 200 && (
            <p className="text-xs text-text-muted">Auf 200 Treffer begrenzt -- es könnten mehr sein.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Neue Campingplätze ({newCampsiteRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {newCampsiteRows.map((s) => (
            <Link
              key={s.id}
              href={`/campingplaetze/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <div>
                <p className="font-medium">{s.name ?? s.external_key}</p>
                <p className="text-text-muted">{s.city}</p>
              </div>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {newCampsiteRows.length === 0 && <p className="text-sm text-text-muted">Keine neuen Campingplätze diese Woche.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Geänderte Campingplätze ({changedCampsiteRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {changedCampsiteRows.map((s) => (
            <Link
              key={s.id}
              href={`/campingplaetze/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <div>
                <p className="font-medium">{s.name ?? s.external_key}</p>
                <p className="text-text-muted">{s.city}</p>
              </div>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.updated_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {changedCampsiteRows.length === 0 && <p className="text-sm text-text-muted">Keine geänderten Campingplätze diese Woche.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Neue Fahrzeugmodelle ({newVehicleModelRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {newVehicleModelRows.map((m) => (
            <Link
              key={m.id}
              href={`/fahrzeugmodelle/${m.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <p className="font-medium">
                {m.manufacturer} {m.model} {m.variant}
              </p>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(m.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {newVehicleModelRows.length === 0 && (
            <p className="text-sm text-text-muted">Keine neuen Fahrzeugmodelle diese Woche.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Neue Wohnwagenmodelle ({newCaravanModelRows.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {newCaravanModelRows.map((m) => (
            <Link
              key={m.id}
              href={`/wohnwagenmodelle/${m.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <p className="font-medium">
                {m.manufacturer} {m.model} {m.series ? `(${m.series})` : ""}
              </p>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(m.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {newCaravanModelRows.length === 0 && (
            <p className="text-sm text-text-muted">Keine neuen Wohnwagenmodelle diese Woche.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Offene Modellvorschläge von Nutzern ({pendingVehicleSuggestionRows.length + pendingCaravanSuggestionRows.length})</h2>
        <p className="mt-1 text-sm text-text-muted">
          Manuell in &quot;Mein Gespann&quot; eingetragene Fahrzeuge/Wohnwagen ohne Katalog-Treffer, die Nutzer als
          neues Modell vorgeschlagen haben -- wartet auf Prüfung, unabhängig vom Zeitraum dieser Woche.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {pendingVehicleSuggestionRows.map((s) => (
            <Link
              key={`v-${s.id}`}
              href={`/fahrzeugmodelle/vorschlaege/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <p className="font-medium">
                {s.manufacturer} {s.model} <span className="text-text-muted">(Fahrzeug)</span>
              </p>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {pendingCaravanSuggestionRows.map((s) => (
            <Link
              key={`c-${s.id}`}
              href={`/wohnwagenmodelle/vorschlaege/${s.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm hover:bg-line/20"
            >
              <p className="font-medium">
                {s.manufacturer} {s.model} <span className="text-text-muted">(Wohnwagen)</span>
              </p>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(s.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </Link>
          ))}
          {pendingVehicleSuggestionRows.length === 0 && pendingCaravanSuggestionRows.length === 0 && (
            <p className="text-sm text-text-muted">Keine offenen Modellvorschläge.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Neue Nutzer ({newUsers.length})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {newUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md border border-line bg-card p-3 text-sm">
              <p className="font-medium">{u.email ?? u.id}</p>
              <p className="whitespace-nowrap text-xs text-text-muted">
                {new Date(u.created_at).toLocaleDateString("de-DE", { dateStyle: "medium" })}
              </p>
            </div>
          ))}
          {newUsers.length === 0 && <p className="text-sm text-text-muted">Keine neuen Nutzer diese Woche.</p>}
        </div>
      </section>
    </div>
  );
}
