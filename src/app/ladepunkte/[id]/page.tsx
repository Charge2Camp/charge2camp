import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Caravan, ChargingReview, ChargingStation, Vehicle } from "@/types/database";
import { MapView } from "@/components/map/map-view";
import { ChargingReviewForm } from "@/components/charging-stations/review-form";
import { RigLengthDistributionChart } from "@/components/charging-stations/rig-length-distribution";
import { TRAILER_SUITABILITY_COLORS, TRAILER_SUITABILITY_LABELS } from "@/lib/trailer-suitability";
import {
  assessPersonalCompatibility,
  bucketReviewsByRigLength,
  PERSONAL_COMPATIBILITY_LABELS,
  summarizeCommunitySuitability,
} from "@/lib/scoring/trailer-compatibility";

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

const CRITERION_LABELS: Record<
  "enough_space_for_rig" | "unobstructed_access" | "no_barrier_or_garage" | "side_mounted_charger",
  string
> = {
  enough_space_for_rig: "Genug Platz",
  unobstructed_access: "Freie Rangierfläche",
  no_barrier_or_garage: "Kein Parkhaus/Schranke",
  side_mounted_charger: "Ladesäule seitlich mit Kabellänge",
};

export default async function ChargingStationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: station }, { data: reviews }, { data: { user } }] = await Promise.all([
    supabase.from("charging_stations").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("charging_reviews")
      .select("*")
      .eq("charging_station_id", id)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  if (!station) notFound();
  const s = station as ChargingStation;
  const allReviews = (reviews as ChargingReview[]) ?? [];

  let ownCaravans: Caravan[] = [];
  let ownVehicles: Vehicle[] = [];
  if (user) {
    const [{ data: caravanData }, { data: vehicleData }] = await Promise.all([
      supabase
        .from("caravans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    ownCaravans = (caravanData as Caravan[]) ?? [];
    ownVehicles = (vehicleData as Vehicle[]) ?? [];
  }
  const ownCaravan = ownCaravans[0] ?? null;

  const communitySummary = summarizeCommunitySuitability(allReviews);
  const rigLengthDistribution = bucketReviewsByRigLength(allReviews);
  const personalCompatibility = user
    ? assessPersonalCompatibility(communitySummary, ownCaravan?.length_m ?? null)
    : "keine_daten";

  const ownReview = user ? allReviews.find((r) => r.user_id === user.id) : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-sm text-black/50 dark:text-white/50">{s.provider}</p>
      <h1 className="text-3xl font-bold">{s.name ?? s.provider}</h1>

      <span
        className="mt-2 inline-block rounded-full px-3 py-1 text-sm text-white"
        style={{ backgroundColor: TRAILER_SUITABILITY_COLORS[s.trailer_suitable] }}
      >
        {TRAILER_SUITABILITY_LABELS[s.trailer_suitable]}
      </span>

      <div className="mt-6 h-[320px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <MapView markers={[{ id: s.id, latitude: s.latitude, longitude: s.longitude, label: s.name ?? s.provider }]} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <section>
          <h2 className="font-semibold">Technische Daten</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {s.power_kw && <li>Ladeleistung: {s.power_kw} kW</li>}
            {s.connector_type && <li>Steckertyp: {s.connector_type}</li>}
            {s.connector_count && <li>Anzahl Anschlüsse: {s.connector_count}</li>}
            {s.price != null && (
              <li>
                Preis: {s.price.toFixed(2)} {s.currency ?? "EUR"}/kWh
              </li>
            )}
            {s.opening_hours && <li>Öffnungszeiten: {s.opening_hours}</li>}
            {s.address && <li>Adresse: {s.address}</li>}
          </ul>
          {s.trailer_notes && (
            <p className="mt-3 text-sm text-black/70 dark:text-white/70">{s.trailer_notes}</p>
          )}
          {s.status.startsWith("demo_") && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              [DEMO] Live-Status (frei/belegt/außer Betrieb) ist in diesem Testdatensatz nicht
              verfügbar.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-semibold">Gespann-Kompatibilität</h2>
          <p className="mt-2 text-sm">{communitySummary.summary}</p>
          {communitySummary.overallPositiveRatio !== null && (
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {Math.round(communitySummary.overallPositiveRatio * 100)}% positive Rückmeldungen ·{" "}
              {communitySummary.reviewCount} Bewertungen
            </p>
          )}

          <div className="mt-4 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {PERSONAL_COMPATIBILITY_LABELS[personalCompatibility]}
            {personalCompatibility === "keine_daten" && !user && (
              <span className="mt-1 block text-xs font-normal text-black/50 dark:text-white/50">
                <Link href="/login" className="text-emerald-600 hover:underline">
                  Anmelden
                </Link>{" "}
                und Wohnwagen im Profil hinterlegen für eine persönliche Einschätzung.
              </span>
            )}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="font-semibold">Eignung nach Gespannlänge</h2>
        <div className="mt-2">
          <RigLengthDistributionChart distribution={rigLengthDistribution} />
        </div>
      </section>

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
                <p className="font-medium">{SUITABLE_LABELS[review.suitable]}</p>
                <p className="text-black/60 dark:text-white/60">
                  {review.trailer_length_m && `${review.trailer_length_m} m`}
                  {review.trailer_width_m && ` × ${review.trailer_width_m} m`}
                  {review.caravan_model && ` · ${review.caravan_model}`}
                </p>
                {review.suitable === "limited" && review.decoupled_parking_possible !== null && (
                  <p className="text-black/60 dark:text-white/60">
                    Wohnwagen abkoppeln &amp; in der Nähe parken:{" "}
                    {review.decoupled_parking_possible ? "möglich" : "nicht möglich"}
                  </p>
                )}
                {(
                  Object.keys(CRITERION_LABELS) as Array<keyof typeof CRITERION_LABELS>
                ).some((key) => review[key] !== null) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(Object.keys(CRITERION_LABELS) as Array<keyof typeof CRITERION_LABELS>)
                      .filter((key) => review[key] !== null)
                      .map((key) => (
                        <span
                          key={key}
                          className={`rounded-full px-2 py-0.5 text-xs text-white ${
                            review[key] ? "bg-emerald-600" : "bg-red-600"
                          }`}
                        >
                          {review[key] ? "✓" : "✗"} {CRITERION_LABELS[key]}
                        </span>
                      ))}
                  </div>
                )}
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
              Du hast diesen Ladepunkt bereits bewertet ({SUITABLE_LABELS[ownReview.suitable]}).
            </p>
          ) : (
            <ChargingReviewForm stationId={s.id} vehicles={ownVehicles} caravans={ownCaravans} />
          )}
        </div>
      </section>
    </div>
  );
}
