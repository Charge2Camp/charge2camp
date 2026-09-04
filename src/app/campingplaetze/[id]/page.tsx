import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Campsite, CampsiteReview } from "@/types/database";
import { fetchNearbyChargingStations, nearestFastChargerDistanceKm } from "@/lib/nearby-charging";
import { calculateEvCampingScore } from "@/lib/scoring/ev-camping-score";
import { MapView } from "@/components/map/map-view";
import { EvScoreBadge } from "@/components/campsites/ev-score-badge";
import { CampsiteReviewForm } from "@/components/campsites/review-form";
import { AMENITY_FIELDS, AMENITY_LABELS } from "@/lib/campsites";

export default async function CampsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: campsite }, { data: reviews }, { data: { user } }] = await Promise.all([
    supabase.from("campsites").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("campsite_reviews")
      .select("*")
      .eq("campsite_id", id)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (!campsite) notFound();

  const ownReview = user
    ? (reviews as CampsiteReview[] | null)?.find((r) => r.user_id === user.id)
    : undefined;

  const site = campsite as Campsite;
  const nearbyStations = await fetchNearbyChargingStations(site);
  const scoreBreakdown = calculateEvCampingScore(
    site,
    nearestFastChargerDistanceKm(nearbyStations)
  );

  const activeAmenities = AMENITY_FIELDS.filter((f) => site[f]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-black/50 dark:text-white/50">
        {[site.region, site.country].filter(Boolean).join(", ")}
      </p>
      <h1 className="text-3xl font-bold">{site.name}</h1>

      {site.rating_avg && (
        <p className="mt-1 text-sm">
          ★ {site.rating_avg.toFixed(1)} ({reviews?.length ?? 0} Bewertungen)
        </p>
      )}

      <div className="mt-6 h-[320px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <MapView
          markers={[
            { id: site.id, latitude: site.latitude, longitude: site.longitude, label: site.name },
          ]}
        />
      </div>

      {site.description && <p className="mt-6 text-black/80 dark:text-white/80">{site.description}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section>
          <h2 className="font-semibold">Ausstattung</h2>
          {activeAmenities.length === 0 ? (
            <p className="mt-2 text-sm text-black/50 dark:text-white/50">Keine Angaben.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {activeAmenities.map((f) => (
                <li
                  key={f}
                  className="rounded-full border border-black/10 px-3 py-1 dark:border-white/10"
                >
                  {AMENITY_LABELS[f]}
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
                      className="text-emerald-600 hover:underline"
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
              {site.ev_charging_on_site ? "ja" : site.ev_charging_nearby ? "in Laufnähe" : "nein"}
            </li>
            {site.max_charging_power_kw && <li>Max. Ladeleistung: {site.max_charging_power_kw} kW</li>}
            {site.number_of_charging_points && (
              <li>Anzahl Ladepunkte: {site.number_of_charging_points}</li>
            )}
          </ul>

          <div className="mt-4">
            <EvScoreBadge breakdown={scoreBreakdown} campsite={site} />
          </div>
        </section>
      </div>

      {nearbyStations.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Ladepunkte in der Nähe</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {nearbyStations.slice(0, 5).map((station) => (
              <li key={station.id}>
                <Link
                  href={`/ladepunkte/${station.id}`}
                  className="flex items-center justify-between rounded-md border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  <div>
                    <p className="font-medium">{station.name ?? station.provider}</p>
                    <p className="text-black/60 dark:text-white/60">
                      {station.power_kw ? `${station.power_kw} kW` : ""}
                      {station.trailer_suitable === "confirmed" && " · anhängertauglich bestätigt"}
                      {station.trailer_suitable === "likely" && " · vermutlich anhängertauglich"}
                      {station.trailer_suitable === "unsuitable" && " · nicht anhängertauglich"}
                    </p>
                  </div>
                  <span className="text-black/50 dark:text-white/50">
                    {station.distanceKm.toFixed(1)} km
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Bewertungen</h2>
        {!reviews || reviews.length === 0 ? (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            Noch keine Bewertungen vorhanden.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {(reviews as CampsiteReview[]).map((review) => (
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
              <Link href="/login" className="text-emerald-600 hover:underline">
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
