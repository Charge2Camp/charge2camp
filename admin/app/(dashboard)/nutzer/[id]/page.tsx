import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteAccount, setBanned, setIsAdmin, setReviewsBlocked } from "./actions";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase.auth.admin.getUserById(id);
  if (!data?.user) notFound();
  const user = data.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, reviews_blocked")
    .eq("id", id)
    .maybeSingle();
  const isAdmin = profile?.is_admin ?? false;
  const reviewsBlocked = profile?.reviews_blocked ?? false;
  const isBanned = Boolean(user.banned_until && new Date(user.banned_until) > new Date());

  const [
    { count: favoritesCount },
    { count: caravansCount },
    { count: vehiclesCount },
    { count: savedRoutesCount },
    { count: routesPlannedCount },
    { count: segmentExportCount },
    { count: fullExportCount },
    { data: lastEventRows },
    { data: chargingReviewRows },
    { data: campsiteReviewRows },
  ] = await Promise.all([
    supabase.from("favorites").select("user_id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("caravans").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("saved_routes").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase
      .schema("core")
      .from("app_usage_event")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "route_planned")
      .eq("user_id", id),
    supabase
      .schema("core")
      .from("app_usage_event")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "route_segment_export")
      .eq("user_id", id),
    supabase
      .schema("core")
      .from("app_usage_event")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "route_full_export")
      .eq("user_id", id),
    // "Zuletzt aktiv" = juengstes app_usage_event dieses Nutzers -- echte
    // Nutzung (Route geplant/exportiert), nicht nur last_sign_in_at (reiner
    // Login-Zeitpunkt, sagt nichts darueber, ob die Session danach ueberhaupt
    // genutzt wurde). Siehe gleiches Prinzip auf der Nutzerliste.
    supabase
      .schema("core")
      .from("app_usage_event")
      .select("created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    // Qualitaet/Menge der Bewertungen pro Nutzer (Nutzerwunsch, Missbrauchs-
    // pruefung) -- "suitable" statt nur der Anzahl, um positive/negative
    // Bewertungen unterscheiden zu koennen.
    supabase.from("charging_reviews").select("suitable").eq("user_id", id),
    supabase.from("campsite_reviews").select("rating").eq("user_id", id),
  ]);
  const lastActiveAt = lastEventRows?.[0]?.created_at as string | undefined;

  const chargingReviews = chargingReviewRows ?? [];
  const chargingReviewStats = {
    total: chargingReviews.length,
    yes: chargingReviews.filter((r) => r.suitable === "yes").length,
    limited: chargingReviews.filter((r) => r.suitable === "limited").length,
    no: chargingReviews.filter((r) => r.suitable === "no").length,
  };
  const campsiteReviews = campsiteReviewRows ?? [];
  const campsiteReviewStats = {
    total: campsiteReviews.length,
    // >=4 Sterne positiv, <=2 negativ, 3 neutral -- gleiche Schwelle wie
    // "gute"/"schlechte" Bewertung in ueblichen 5-Sterne-Skalen.
    positive: campsiteReviews.filter((r) => r.rating >= 4).length,
    negative: campsiteReviews.filter((r) => r.rating <= 2).length,
    avg: campsiteReviews.length
      ? campsiteReviews.reduce((sum, r) => sum + r.rating, 0) / campsiteReviews.length
      : null,
  };

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{user.email}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Registriert am {new Date(user.created_at).toLocaleDateString("de-DE")} · Zuletzt angemeldet:{" "}
          {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "nie"}
          {" · "}Zuletzt aktiv:{" "}
          {lastActiveAt ? new Date(lastActiveAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "nie (seit 29.09.2026 protokolliert)"}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {vehiclesCount ?? 0} Fahrzeuge · {caravansCount ?? 0} Wohnwagen · {favoritesCount ?? 0} Favoriten ·{" "}
          {savedRoutesCount ?? 0} gespeicherte Routen
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {routesPlannedCount ?? 0} Routen geplant · {segmentExportCount ?? 0} Etappen exportiert ·{" "}
          {fullExportCount ?? 0} ganze Routen exportiert (jeweils seit 29.09.2026 protokolliert)
        </p>
      </div>

      <section className="rounded-md border border-line bg-card p-4">
        <h2 className="font-medium">Bewertungen</h2>
        <p className="mt-2 text-sm text-text-muted">
          Ladepunkte: {chargingReviewStats.total} gesamt · {chargingReviewStats.yes} „Ja&rdquo; ·{" "}
          {chargingReviewStats.limited} „Mit Einschränkungen&rdquo; · {chargingReviewStats.no} „Nein&rdquo;
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Campingplätze: {campsiteReviewStats.total} gesamt
          {campsiteReviewStats.avg !== null && ` · Ø ${campsiteReviewStats.avg.toFixed(1)} Sterne`}
          {campsiteReviewStats.total > 0 &&
            ` · ${campsiteReviewStats.positive} positiv (≥4★) · ${campsiteReviewStats.negative} negativ (≤2★)`}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-line bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span>Admin-Berechtigung</span>
          <form action={setIsAdmin.bind(null, id, !isAdmin)}>
            <button
              type="submit"
              className={`min-h-9 rounded-md border px-3 text-sm font-medium ${
                isAdmin ? "border-route text-route hover:bg-route/10" : "border-line hover:bg-line/20"
              }`}
            >
              {isAdmin ? "Admin entziehen" : "Zum Admin machen"}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>Kontosperre</span>
          <form action={setBanned.bind(null, id, !isBanned)}>
            <button
              type="submit"
              className={`min-h-9 rounded-md border px-3 text-sm font-medium ${
                isBanned ? "border-route text-route hover:bg-route/10" : "border-status-down text-status-down hover:bg-status-down/10"
              }`}
            >
              {isBanned ? "Entsperren" : "Sperren"}
            </button>
          </form>
        </div>

        {/* Missbrauchsschutz (Nutzerwunsch): nur neue/geaenderte Bewertungen
            gesperrt, Rest des Kontos bleibt nutzbar -- milder als die
            Kontosperre oben, siehe setReviewsBlocked. */}
        <div className="flex items-center justify-between text-sm">
          <span>Bewertungen abgeben</span>
          <form action={setReviewsBlocked.bind(null, id, !reviewsBlocked)}>
            <button
              type="submit"
              className={`min-h-9 rounded-md border px-3 text-sm font-medium ${
                reviewsBlocked ? "border-route text-route hover:bg-route/10" : "border-status-down text-status-down hover:bg-status-down/10"
              }`}
            >
              {reviewsBlocked ? "Wieder freigeben" : "Sperren"}
            </button>
          </form>
        </div>
        {reviewsBlocked && (
          <p className="text-xs text-status-down">
            Dieser Nutzer kann aktuell keine neuen Bewertungen abgeben oder bestehende ändern. Bereits vorhandene
            Bewertungen bleiben sichtbar.
          </p>
        )}
      </section>

      <section className="rounded-md border border-status-down/40 bg-status-down/5 p-4">
        <h2 className="font-medium text-status-down">Konto löschen</h2>
        <p className="mt-1 text-sm text-text-muted">
          Löscht das Konto unwiderruflich, inklusive Profil, Fahrzeuge, Wohnwagen, Favoriten und Bewertungen.
        </p>
        <form action={deleteAccount.bind(null, id)} className="mt-3">
          <ConfirmSubmitButton
            confirmText={`Konto ${user.email} wirklich unwiderruflich löschen?`}
            className="min-h-11 rounded-md border border-status-down px-4 text-sm font-medium text-status-down hover:bg-status-down/10"
          >
            Konto löschen
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
