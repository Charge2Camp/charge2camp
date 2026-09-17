import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/require-user";
import type { CampsiteReview } from "@/types/database";
import type { CampsiteSearchRow, CoreCampsite } from "@/types/database";
import { fetchAmenityCatalog } from "@/lib/campsites";
import {
  fetchLinkedChargePoints,
  fetchNearbyChargePoints,
  type LinkedChargePoint,
  type NearbyChargePoint,
} from "@/lib/campsite-charging-links";
import { calculateEvCampingScore } from "@/lib/scoring/ev-camping-score";
import { CAMPSITE_PIN_ICON_SRC } from "@/lib/trailer-verdict";
import { MapView } from "@/components/map/map-view";
import { EvScoreBadge } from "@/components/campsites/ev-score-badge";
import { CampsiteReviewForm } from "@/components/campsites/review-form";
import { CampsiteFavoriteButton } from "@/components/campsites/favorite-button";
import { NearbyChargePointsList } from "@/components/campsites/nearby-charge-points";
import { ListNavigation } from "@/components/list-navigation";

const NEARBY_RADIUS_KM = 25;
// Auch nicht-fussläufige Schnelllader sind erwaehnenswert, wenn sie stark
// genug sind, um den Umweg mit dem Auto zu rechtfertigen -- 150 kW+ laedt
// ein Gespann in Minuten statt Stunden.
const FAST_CHARGER_MIN_KW = 150;
const FAST_CHARGER_RADIUS_KM = 15;

function formatReviewMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Popup fuer die Kartenpins der Ladepunkte im 25-km-Umkreis (MapView,
// popupHtml) -- Kurzinfo direkt auf der Karte, mit Link zur vollen
// Detailseite, statt sofort dorthin zu navigieren.
function buildNearbyChargePointPopupHtml(point: NearbyChargePoint): string {
  const name = escapeHtml(point.name ?? point.operator ?? "Ladepunkt");
  const distanceKm = (point.distance_m / 1000).toFixed(1);
  return `
    <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5; max-width: 220px;">
      <p style="margin: 0 0 4px; font-weight: 600;">${name}</p>
      <ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; opacity: 0.8;">
        ${point.max_power_kw ? `<li>${point.max_power_kw} kW</li>` : ""}
        <li>${distanceKm} km Luftlinie</li>
      </ul>
      <a href="/ladepunkte/${point.id}" style="display: inline-block; margin-top: 8px; color: #1D9E75; font-weight: 500;">Zur Ladestation →</a>
    </div>
  `;
}

export default async function CampsiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Browsen erfordert Login (Sicherheits-Audit) -- siehe require-user.ts.
  const user = await requireUser(`/campingplaetze/${id}`);
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data: campsite }, { data: searchRow }] = await Promise.all([
    adminClient.schema("core").from("campsite").select("*").eq("id", id).eq("is_active", true).maybeSingle(),
    adminClient.schema("core").from("campsite_search").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!campsite) notFound();

  const site = campsite as CoreCampsite;
  const search = searchRow as CampsiteSearchRow | null;

  const [{ data: reviews }, favoriteResult, amenityCatalog, linkedChargePoints, nearbyChargePoints] = await Promise.all([
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
    search ? fetchNearbyChargePoints(search.lat, search.lon, NEARBY_RADIUS_KM) : Promise.resolve([]),
  ]);

  const allReviews = (reviews as CampsiteReview[]) ?? [];
  const isFavorite = Boolean(favoriteResult.data);
  const ownReview = user ? allReviews.find((r) => r.user_id === user.id) : undefined;
  const ratingAvg = allReviews.length > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length : null;

  const amenityLabels = Object.fromEntries(amenityCatalog.map((a) => [a.key, a.label_de]));
  const activeAmenities = search?.amenities ?? [];

  // "Ladepunkte in der Naehe" zeigt primaer fussläufig erreichbare
  // Ladepunkte (linkedChargePoints, schon auf max. 15 Gehminuten
  // beschraenkt, siehe fetchLinkedChargePoints) -- davon max. die 3
  // staerksten (hoechste Ladeleistung = groesste Relevanz fuers Gespann-
  // Laden), ergaenzt um max. 2 Schnelllader ab FAST_CHARGER_MIN_KW im
  // FAST_CHARGER_RADIUS_KM-Umkreis (naechstgelegene zuerst), die den
  // Umweg mit dem Auto lohnen -- deutlich als "nicht fußläufig"
  // gekennzeichnet (siehe NearbyChargePointsList). Macht max. 5 Eintraege
  // insgesamt.
  const MAX_WALKABLE_LISTED = 3;
  const MAX_FAST_CHARGERS_LISTED = 2;
  const topWalkableChargePoints = [...linkedChargePoints]
    .sort((a, b) => (b.max_power_kw ?? 0) - (a.max_power_kw ?? 0))
    .slice(0, MAX_WALKABLE_LISTED);

  const linkedIds = new Set(linkedChargePoints.map((l) => l.id));
  const nonWalkableFastChargers: LinkedChargePoint[] = nearbyChargePoints
    .filter(
      (p) =>
        !linkedIds.has(p.id) && p.max_power_kw != null && p.max_power_kw >= FAST_CHARGER_MIN_KW && p.distance_m <= FAST_CHARGER_RADIUS_KM * 1000
    )
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, MAX_FAST_CHARGERS_LISTED)
    .map((p) => ({
      id: p.id,
      external_key: "",
      name: p.name,
      operator: p.operator,
      max_power_kw: p.max_power_kw,
      relation: "nearby_drive",
      air_distance_m: p.distance_m,
      walk_distance_m: null,
      walk_duration_s: null,
      latitude: p.latitude,
      longitude: p.longitude,
      trailerVerdict: p.trailerVerdict,
      trailerOrigin: p.trailerOrigin,
      walkable: false,
    }));
  const nearbyListChargePoints = [...topWalkableChargePoints, ...nonWalkableFastChargers];

  const onSiteChargePoints = linkedChargePoints.filter((l) => l.relation === "on_site");
  const fastChargers = linkedChargePoints.filter((l) => (l.max_power_kw ?? 0) >= 100 && l.walk_distance_m != null);
  const nearestFastChargerKm =
    fastChargers.length > 0 ? Math.min(...fastChargers.map((l) => (l.walk_distance_m ?? 0) / 1000)) : null;

  // "Anzahl Ladepunkte auf dem Platz" wird per OSM-Verknuepfung (core.
  // campsite_charge_link) geschaetzt, das erfasst nicht jeden real
  // existierenden Ladepunkt (z. B. ohne eigenen OSM-Node). Ein Admin kann
  // das im Backend manuell korrigieren (enrich.campsite_charging.
  // point_count, siehe admin/app/(dashboard)/campingplaetze/[id]) -- diese
  // Korrektur hat Vorrang vor der automatischen Zaehlung.
  const numberOfChargingPoints = search?.on_site_point_count ?? (onSiteChargePoints.length || null);

  const scoreBreakdown = calculateEvCampingScore(
    {
      ev_charging_on_site: search?.charging_on_site ?? false,
      max_charging_power_kw: search?.on_site_power_kw ?? null,
      number_of_charging_points: numberOfChargingPoints,
      rating_avg: ratingAvg,
      last_verified_at: null, // keine Verifizierungs-Zeitstempel fuer echte Daten, siehe docs/architecture.md
    },
    nearestFastChargerKm
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <ListNavigation storageKey="campingplaetze:list-nav" detailPathPrefix="/campingplaetze/" currentId={site.id} />

      <p className="text-sm text-black/50 dark:text-white/50">
        {[site.city, site.country_code].filter(Boolean).join(", ")}
      </p>
      <h1 className="text-3xl font-bold">{site.name}</h1>

      {ratingAvg !== null && (
        <p className="mt-1 text-sm">
          ★ {ratingAvg.toFixed(1)} ({allReviews.length} Bewertungen)
        </p>
      )}

      {user && (
        <div className="mt-4">
          <CampsiteFavoriteButton campsiteId={site.id} initialIsFavorite={isFavorite} />
        </div>
      )}

      <div className="mt-6">
        <EvScoreBadge
          breakdown={scoreBreakdown}
          campsite={{
            max_charging_power_kw: search?.on_site_power_kw ?? null,
            number_of_charging_points: numberOfChargingPoints,
            rating_avg: ratingAvg,
          }}
          overrideScore={site.ev_score_override}
        />
      </div>

      {(site.address || site.website || site.phone) && (
        <section className="mt-6">
          <h2 className="font-semibold">Adresse</h2>
          <dl className="mt-2 space-y-1 text-sm">
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
        </section>
      )}

      {/* Nutzerwunsch: der Button war oben (neben Titel/Rating)
          unübersichtlich -- steht jetzt direkt unter der Anschrift. */}
      <Link
        href={`/routenplaner?destination_campsite_id=${site.id}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
      >
        Route hierher planen
      </Link>

      {search && (
        <div className="mt-6 h-[400px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          <MapView
            markers={[
              { id: site.id, latitude: search.lat, longitude: search.lon, label: site.name, iconSrc: CAMPSITE_PIN_ICON_SRC },
              ...nearbyChargePoints.map((p) => ({
                id: p.id,
                latitude: p.latitude,
                longitude: p.longitude,
                label: p.name ?? p.operator ?? "Ladepunkt",
                iconSrc: p.iconSrc,
                popupHtml: buildNearbyChargePointPopupHtml(p),
              })),
            ]}
            fitBoundsPoints={[
              { latitude: search.lat, longitude: search.lon },
              ...topWalkableChargePoints.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
            ]}
            fitBoundsMaxZoom={17}
            cluster
          />
        </div>
      )}

      <section className="mt-6">
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
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">EV-Informationen</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            Ladepunkt auf dem Platz:{" "}
            {search?.charging_on_site ? "ja" : search?.nearest_walk_m != null ? "in Laufnähe" : "nein bekannt"}
          </li>
          {search?.on_site_power_kw && <li>Max. Ladeleistung: {search.on_site_power_kw} kW</li>}
          {numberOfChargingPoints !== null && <li>Anzahl Ladepunkte auf dem Platz: {numberOfChargingPoints}</li>}
        </ul>
      </section>

      {nearbyListChargePoints.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-semibold">Ladepunkte in der Nähe</h2>
          <NearbyChargePointsList points={nearbyListChargePoints} />
        </section>
      ) : (
        <p className="mt-8 text-xs text-black/40 dark:text-white/40">
          Keine Ladepunkte innerhalb von 15 Gehminuten bekannt (oder noch keine Fußweg-Verknüpfung für diesen
          Campingplatz berechnet).
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
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">★ {review.rating}/5</p>
                  <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                    {formatReviewMonth(review.created_at)}
                  </span>
                </div>
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
