import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CoreChargePointGeo, CoreConnector, TrailerSuitabilityRecord } from "@/types/database";
import { MapView } from "@/components/map/map-view";
import { StationTechnicalDetails } from "@/components/charging-stations/station-technical-details";
import { StationFavoriteRow } from "@/components/charging-stations/station-favorite-row";
import { StationCompatibilitySummary } from "@/components/charging-stations/station-compatibility";
import { RigLengthDistributionChart } from "@/components/charging-stations/rig-length-distribution";
import { StationReviewsList } from "@/components/charging-stations/station-reviews-list";
import { StationBlockSection } from "@/components/charging-stations/station-block-section";
import { TRAILER_PIN_COLORS, TRAILER_PIN_ICON_SRC, TRAILER_PIN_LABELS, getTrailerPinState } from "@/lib/trailer-verdict";
import { ReviewStateBadge } from "@/components/charging-stations/review-state-badge";
import { ListNavigation } from "@/components/list-navigation";
import { fetchChargingStationDetailExtras } from "@/lib/charging-station-detail";
import type { ChargingStationView } from "@/lib/charging-stations";

export default async function ChargingStationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  // Vom "Details ansehen"-Link bei einem Ladestopp/einer Alternative in
  // Tab 2 des Routenplaners (Nutzerwunsch): zeigt den "Zurück"-Link unten,
  // der den zwischengespeicherten Planungsstand wiederherstellt statt neu
  // zu beginnen -- siehe route-planner-form.tsx handleViewStationDetails.
  const { returnTo } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: station }, { data: connectors }] = await Promise.all([
    supabase.schema("core").from("charge_point_geo").select("*").eq("id", id).maybeSingle(),
    supabase.schema("core").from("connector").select("*").eq("charge_point_id", id),
  ]);

  if (!station) notFound();
  const s = station as CoreChargePointGeo;
  const stationConnectors = (connectors as CoreConnector[]) ?? [];

  const { data: trailerRow } = await supabase
    .schema("enrich")
    .from("trailer_suitability")
    .select("*")
    .eq("charge_point_key", s.external_key)
    .maybeSingle();
  const trailer = trailerRow as TrailerSuitabilityRecord | null;
  const pinState = getTrailerPinState(trailer);
  const stationView: ChargingStationView = { ...s, connectors: stationConnectors, trailer };

  const extras = await fetchChargingStationDetailExtras(id, user?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <ListNavigation
        storageKey="ladepunkte:list-nav"
        detailPathPrefix="/ladepunkte/"
        currentId={s.id}
        disableFallback={returnTo === "routenplaner"}
      />

      <p className="text-sm text-black/50 dark:text-white/50">{s.operator}</p>
      <h1 className="text-3xl font-bold">{s.name ?? s.operator}</h1>

      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className="inline-block rounded-full px-3 py-1 text-sm text-white"
          style={{ backgroundColor: TRAILER_PIN_COLORS[pinState] }}
        >
          {TRAILER_PIN_LABELS[pinState]}
        </span>
        <ReviewStateBadge origin={trailer?.origin} className="px-3 py-1 text-sm" />
      </div>

      {returnTo === "routenplaner" && (
        <Link
          href="/routenplaner?resumeDraft=1"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-route hover:underline"
        >
          ← Zurück zur Routenplanung
        </Link>
      )}

      {user && (
        <StationFavoriteRow
          station={stationView}
          isFavorite={extras.isFavorite}
          personalCompatibility={extras.personalCompatibility}
        />
      )}

      <div className="mt-6 h-[320px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <MapView
          markers={[
            {
              id: s.id,
              latitude: s.lat,
              longitude: s.lon,
              label: s.name ?? s.operator ?? "",
              iconSrc: TRAILER_PIN_ICON_SRC[pinState],
            },
          ]}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StationTechnicalDetails station={stationView} />
        <StationCompatibilitySummary
          communitySummary={extras.communitySummary}
          personalCompatibility={extras.personalCompatibility}
          isLoggedIn={Boolean(user)}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-semibold">Eignung nach Gespannlänge</h2>
        <div className="mt-2">
          <RigLengthDistributionChart distribution={extras.rigLengthDistribution} />
        </div>
      </section>

      <StationReviewsList
        reviews={extras.reviews}
        isLoggedIn={Boolean(user)}
        ownReview={extras.ownReview}
        stationId={s.id}
        externalKey={s.external_key}
        vehicles={extras.ownVehicles}
        caravans={extras.ownCaravans}
      />

      {user && <StationBlockSection stationId={s.id} isBlocked={extras.isBlocked} />}
    </div>
  );
}
