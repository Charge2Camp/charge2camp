import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CampsiteReview } from "@/types/database";
import type { CampsiteSearchRow, CoreCampsite } from "@/types/database";
import { fetchAmenityCatalog } from "@/lib/campsites";
import { fetchLinkedChargePoints } from "@/lib/campsite-charging-links";
import { calculateEvCampingScore } from "@/lib/scoring/ev-camping-score";
import { MapView } from "@/components/map/map-view";
import { EvScoreBadge } from "@/components/campsites/ev-score-badge";
import { CampsiteReviewForm } from "@/components/campsites/review-form";
import { CampsiteFavoriteButton } from "@/components/campsites/favorite-button";
import { TRAILER_VERDICT_COLORS, TRAILER_VERDICT_LABELS } from "@/lib/trailer-verdict";

export default async function CampsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: campsite }, { data: searchRow }, { data: reviews }, favoriteResult, amenityCatalog, linkedChargePoints] =
    await Promise.all([
      supabase.schema("core").from("campsite").select("*").eq("id", id).maybeSingle(),
      supabase.schema("core").from("campsite_search").select("*").eq("id", id).maybeSingle(),
      supabase.from("campsite_reviews").select("*").eq("campsite_id", id).order("created_at", { ascending: false }),
      user
        ? supabase
            .from("favorites")
            .select("entity_id")
            .eq("user_id", user.id)
            .eq("entity_type", "campsite")
            .eq("entity_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      fetchAmenityCatalog(),
      fetchLinkedChargePoints(id),
    ]);

  if (!campsite) notFound();

  const site = campsite as CoreCampsite;
  const search = searchRow as CampsiteSearchRow | null;
  const allReviews = (reviews as CampsiteReview[]) ?? [];
  const isFavorite = Boolean(favoriteResult.data);
  const ownReview = user ? allReviews.find((r) => r.user_id === user.id) : undefined;
  const ratingAvg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length : null;

  const amenityLabels = Object.fromEntries(amenityCatalog.map((a) => [a.key, a.label_de]));
  const activeAmenities = search?.amenities ?? [];

  const onSiteChargePoints = linkedChargePoints.filter((l) => l.relation === "on_site");
  const fastChargers = linkedChargePoints.filter((l) => (l.max_power_kw ?? 0) >= 100 && l.walk_distance_m != null);
  const nearestFastChargerKm =
    fastChargers.length > 0 ? Math.min(...fastChargers.map((l) => (l.walk_distance_m ?? 0) / 1000)) : null;

  const scoreBreakdown = calculateEvCampingScore(
    {
      ev_charging_on_site: search?.charging_on_site ?? false,
      max_charging_power_kw: search?.on_site_power_kw ?? null,
      number_of_charging_points: onSiteChargePoints.length || null,
      rating_avg: ratingAvg,
      last_verified_at: null, // keine Verifizierungs-Zeitstempel fuer echte Daten, siehe docs/architecture.md
    },
    nearestFastChargerKm
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-black/50 dark:text-white/50">
        {[site.city, site.country_code].filter(Boolean).join(", ")}
      </p>
      <h1 className="text-3xl font-bold">{site.name}</h1>

      {ratingAvg !== null && (
        <p className="mt-1 text-sm">
          ★ {ratingAvg.toFixed(1)} ({allReviews.length} Bewertungen)
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/routenplaner?destination_campsite_id=${site.id}`}
          className="inline-flex min-h-11 items-center rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
        >
          Route hierher planen
        </Link>
        {user && <CampsiteFavoriteButton campsiteId={site.id} initialIsFavorite={isFavorite} />}
      </div>

      {search && (
        <div className="mt-6 h-[320px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          <MapView markers={[{ id: site.id, latitude: search.lat, longitude: search.lon, label: site.name }]} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section>
          <h2 className="font-semibold">Ausstattung</h2>
          {activeAmenities.length === 0 ? (
            <p className="mt-2 text-sm text-black/50 dark:text-white/50">Keine Angaben.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {activeAmenities.map((key) => (
                <li key={key} className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10">
                  {amenityLabels[key] ?? key}
                </li>
              ))}
            </ul>
          )}

          {(site.address || site.website || site.phone) && (
            <dl className="mt-4 space-y-1 text-sm">
              {site.address && (
                <div>
                  <dt className="inline text-black/50 dark:text-white/50">Adresse: </dt>
                  <dd className="inline">{site.address}</dd>
                </div>
              )}
              {site.phone && (
                <div>
                  <dt className="inline text-black/50 dark:text-white/50">Telefon: </dt>
                  <dd className="inline">{site.phone}</dd>
                </div>
              )}
              {site.website && (
                <div>
                  <dt className="inline text-black/50 dark:text-white/50">Website: </dt>
                  <dd className="inline">
                    <a
                      href={site.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-route hover:underline"
                    >
                      {site.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section>
          <h2 className="font-semibold">EV-Informationen</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              Ladepunkt auf dem Platz:{" "}
              {search?.charging_on_site ? "ja" : search?.nearest_walk_m != null ? "in Laufnähe" : "nein bekannt"}
            </li>
            {search?.on_site_power_kw && <li>Max. Ladeleistung: {search.on_site_power_kw} kW</li>}
            {onSiteChargePoints.length > 0 && <li>Anzahl Ladepunkte auf dem Platz: {onSiteChargePoints.length}</li>}
          </ul>

          <div className="mt-4">
            <EvScoreBadge
              breakdown={scoreBreakdown}
              campsite={{
                max_charging_power_kw: search?.on_site_power_kw ?? null,
                number_of_charging_points: onSiteChargePoints.length || null,
                rating_avg: ratingAvg,
              }}
            />
          </div>
        </section>
      </div>

      {linkedChargePoints.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-semibold">Ladepunkte in der Nähe</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {linkedChargePoints.slice(0, 5).map((point) => (
              <li key={point.id}>
                <Link
                  href={`/ladepunkte/${point.id}`}
                  className="flex items-center justify-between rounded-md border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  <div>
                    <p className="font-medium">{point.name ?? point.operator}</p>
                    <p className="text-black/60 dark:text-white/60">
                      {point.max_power_kw ? `${point.max_power_kw} kW` : ""}
                      {" · "}
                      <span style={{ color: TRAILER_VERDICT_COLORS[point.trailerVerdict] }}>
                        {TRAILER_VERDICT_LABELS[point.trailerVerdict]}
                      </span>
                    </p>
                  </div>
                  <span className="text-black/50 dark:text-white/50">
                    {point.walk_distance_m != null
                      ? `${(point.walk_distance_m / 1000).toFixed(1)} km zu Fuß`
                      : `${(point.air_distance_m / 1000).toFixed(1)} km Luftlinie`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-8 text-xs text-black/40 dark:text-white/40">
          Noch keine Fußweg-Verknüpfung zu Ladepunkten für diesen Campingplatz berechnet.
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Bewertungen</h2>
        {allReviews.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Noch keine Bewertungen vorhanden.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {allReviews.map((review) => (
              <li
                key={review.id}
                className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10"
              >
                <p className="font-medium">★ {review.rating}/5</p>
                {review.comment && <p className="mt-1 text-black/70 dark:text-white/70">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          {!user ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              <Link href="/login" className="text-route hover:underline">
                Anmelden
              </Link>{" "}
              um eine Bewertung abzugeben.
            </p>
          ) : ownReview ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              Du hast diesen Campingplatz bereits bewertet (★ {ownReview.rating}/5).
            </p>
          ) : (
            <CampsiteReviewForm campsiteId={site.id} />
          )}
        </div>
      </section>
    </div>
  );
}
