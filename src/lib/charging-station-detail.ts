import { createClient } from "@/lib/supabase/server";
import {
  assessPersonalCompatibility,
  bucketReviewsByRigLength,
  summarizeCommunitySuitability,
  type CommunitySuitabilitySummary,
  type PersonalCompatibility,
  type RigLengthDistribution,
} from "@/lib/scoring/trailer-compatibility";
import type { Caravan, ChargingReview, Vehicle } from "@/types/database";

export interface ChargingStationDetailExtras {
  reviews: ChargingReview[];
  isFavorite: boolean;
  isBlocked: boolean;
  ownCaravans: Caravan[];
  ownVehicles: Vehicle[];
  communitySummary: CommunitySuitabilitySummary;
  rigLengthDistribution: RigLengthDistribution;
  personalCompatibility: PersonalCompatibility;
  ownReview: ChargingReview | undefined;
}

/** Alles rund um einen Ladepunkt, was NICHT schon aus core.charge_point_geo
 * (Name, Betreiber, Connectoren, Anhaengertauglichkeit -- siehe
 * ChargingStationView in charging-stations.ts) kommt: Bewertungen,
 * Favorit/Blockiert-Status, eigene Fahrzeuge/Wohnwagen sowie die daraus
 * abgeleiteten Gespann-Kompatibilitaets-Auswertungen. Gemeinsam genutzt von
 * der Ladepunkt-Detailseite (ladepunkte/[id]/page.tsx, die Station/
 * Connectoren/Anhaengertauglichkeit selbst weiterhin separat laedt) UND vom
 * Kartenausschnitt-Bottom-Sheet (station-bottom-sheet.tsx via
 * /api/charge-points/[id]/detail) -- letzteres hat die Basisdaten bereits
 * aus dem angetippten Kartenmarker und braucht nur diesen Teil nachzuladen. */
export async function fetchChargingStationDetailExtras(
  stationId: string,
  userId: string | undefined
): Promise<ChargingStationDetailExtras> {
  const supabase = await createClient();

  const [{ data: reviews }, favoriteResult, blockedResult] = await Promise.all([
    supabase
      .from("charging_reviews")
      .select("*")
      .eq("charging_station_id", stationId)
      .order("created_at", { ascending: false }),
    userId
      ? supabase
          .from("favorites")
          .select("entity_id")
          .eq("user_id", userId)
          .eq("entity_type", "charging_station")
          .eq("entity_id", stationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from("blocked_charging_stations")
          .select("charging_station_id")
          .eq("user_id", userId)
          .eq("charging_station_id", stationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allReviews = (reviews as ChargingReview[]) ?? [];
  const isFavorite = Boolean(favoriteResult.data);
  const isBlocked = Boolean(blockedResult.data);

  let ownCaravans: Caravan[] = [];
  let ownVehicles: Vehicle[] = [];
  if (userId) {
    const [{ data: caravanData }, { data: vehicleData }] = await Promise.all([
      supabase.from("caravans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("vehicles").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    ownCaravans = (caravanData as Caravan[]) ?? [];
    ownVehicles = (vehicleData as Vehicle[]) ?? [];
  }
  const ownCaravan = ownCaravans[0] ?? null;

  const communitySummary = summarizeCommunitySuitability(allReviews);
  const rigLengthDistribution = bucketReviewsByRigLength(allReviews);
  const personalCompatibility = userId
    ? assessPersonalCompatibility(communitySummary, ownCaravan?.length_m ?? null)
    : "keine_daten";
  const ownReview = userId ? allReviews.find((r) => r.user_id === userId) : undefined;

  return {
    reviews: allReviews,
    isFavorite,
    isBlocked,
    ownCaravans,
    ownVehicles,
    communitySummary,
    rigLengthDistribution,
    personalCompatibility,
    ownReview,
  };
}
