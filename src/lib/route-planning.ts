import { distanceKm } from "@/lib/geo";
import type { LatLng, RouteResult } from "@/lib/providers/routing/types";
import type { ChargingStation, Vehicle } from "@/types/database";

/**
 * Regelbasierte "erste Ladeplanung" (§21, §26). Schwellwerte zentral und
 * leicht anpassbar. Plant fuer den MVP genau EINEN Ladestopp (kein
 * Mehrstopp-Optimierer) -- ausreichend fuer die meisten Strecken innerhalb
 * der Reichweite eines modernen E-Autos.
 *
 * Verbrauch bewusst NICHT aus Herstellerangaben (Batterie/Reichweite)
 * abgeleitet -- diese sind erfahrungsgemaess unrealistisch optimistisch,
 * insbesondere mit Wohnwagen. Der aufrufende Code (siehe actions.ts) loest
 * den tatsaechlich verwendeten Verbrauch bereits vorher auf: manuelle
 * Eingabe im Routenplaner > Profilangabe (vehicles.consumption_kwh_per_100km)
 * > Standardwert DEFAULT_CONSUMPTION_KWH_PER_100KM.
 */

// Realistischer Standard-Verbrauch, wenn weder im Routenplaner noch im
// Fahrzeugprofil ein Wert angegeben wurde (bewusst hoeher als typische
// Hersteller-WLTP-Angaben, siehe ADAC-Praxistests mit Wohnwagen).
export const DEFAULT_CONSUMPTION_KWH_PER_100KM = 38;

// Sicherheitsmarge: nur bis zu diesem Anteil der theoretischen Reichweite
// verplanen, um nicht mit 0 % anzukommen.
const RANGE_SAFETY_MARGIN = 0.9;

// Ziel-Ladestand nach einem Ladestopp (typischer Schnelllade-Zielwert,
// da die Ladeleistung darueber hinaus stark abfaellt).
const TARGET_SOC_AFTER_CHARGING = 0.8;

// Ladepunkte im Umkreis von X km um die Streckengeometrie gelten als "auf
// der Route".
const ROUTE_CORRIDOR_KM = 15;

// Sicherheits-Reserve am unteren Ende (Kehrwert der Sicherheitsmarge):
// Die Batterie wird planerisch nie unter diesen Ladestand entleert.
const MIN_SOC_RESERVE = 1 - RANGE_SAFETY_MARGIN;

export interface TripPlan {
  distanceKm: number;
  durationMin: number;
  effectiveConsumptionKwhPer100km: number;
  effectiveRangeKm: number;
  chargingStopRequired: boolean;
  chargingStop: {
    station: ChargingStation;
    distanceFromStartKm: number;
    corridorDistanceKm: number;
    socOnArrivalPercent: number;
    chargingTimeMin: number | null;
  } | null;
  departureSocPercent: number;
  arrivalSocPercent: number | null;
  warning: string | null;
}

/** Naeherungsweise kumulierte Distanz (km) vom Streckenanfang bis zu einem
 * gegebenen Geometrie-Index, angenommen gleichmaessige Punktverteilung. */
function cumulativeDistanceAtIndex(index: number, geometryLength: number, totalDistanceKm: number) {
  if (geometryLength <= 1) return 0;
  return (index / (geometryLength - 1)) * totalDistanceKm;
}

function nearestPointOnRoute(
  point: LatLng,
  geometry: LatLng[]
): { index: number; distanceKm: number } {
  let best = { index: 0, distanceKm: Infinity };
  for (let i = 0; i < geometry.length; i++) {
    const d = distanceKm(point, geometry[i]);
    if (d < best.distanceKm) best = { index: i, distanceKm: d };
  }
  return best;
}

export function planTrip({
  route,
  vehicle,
  chargingStations,
  preferTrailerSuitable = true,
  minPowerKw,
  consumptionKwhPer100km,
}: {
  route: RouteResult;
  vehicle: Pick<Vehicle, "battery_capacity_kwh">;
  chargingStations: ChargingStation[];
  preferTrailerSuitable?: boolean;
  minPowerKw?: number;
  /** Bereits aufgeloester Verbrauch (manuell > Profil > Standard), siehe Modul-Kommentar. */
  consumptionKwhPer100km: number;
}): TripPlan {
  const consumption = consumptionKwhPer100km;
  const effectiveRangeKm = (vehicle.battery_capacity_kwh / consumption) * 100;
  const usableRangeKm = effectiveRangeKm * RANGE_SAFETY_MARGIN;
  // Reichweite, die nach einem Ladestopp (nur bis TARGET_SOC_AFTER_CHARGING
  // geladen, nicht bis 100 %) sicher zur Verfuegung steht.
  const usableRangeAfterChargeKm = effectiveRangeKm * (TARGET_SOC_AFTER_CHARGING - MIN_SOC_RESERVE);

  const energyForDistance = (km: number) => (km * consumption) / 100;
  const socPercentAfter = (startSocPercent: number, energyUsedKwh: number) =>
    Math.max(0, startSocPercent - (energyUsedKwh / vehicle.battery_capacity_kwh) * 100);

  // Kein Ladestopp noetig.
  if (route.distanceKm <= usableRangeKm) {
    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      effectiveConsumptionKwhPer100km: consumption,
      effectiveRangeKm,
      chargingStopRequired: false,
      chargingStop: null,
      departureSocPercent: 100,
      arrivalSocPercent: socPercentAfter(100, energyForDistance(route.distanceKm)),
      warning: null,
    };
  }

  // Ladestopp noetig: Kandidaten im Streckenkorridor suchen.
  const candidates = chargingStations
    .map((station) => {
      const nearest = nearestPointOnRoute(station, route.geometry);
      return {
        station,
        corridorDistanceKm: nearest.distanceKm,
        distanceFromStartKm: cumulativeDistanceAtIndex(
          nearest.index,
          route.geometry.length,
          route.distanceKm
        ),
      };
    })
    .filter((c) => c.corridorDistanceKm <= ROUTE_CORRIDOR_KM)
    .filter((c) => c.distanceFromStartKm <= usableRangeKm)
    // von dort auch das Ziel erreichbar -- nach dem Stopp steht nur die auf
    // TARGET_SOC_AFTER_CHARGING begrenzte Reichweite zur Verfuegung, nicht
    // die volle Reichweite (sonst waere die Restetappe optimistisch falsch).
    .filter((c) => route.distanceKm - c.distanceFromStartKm <= usableRangeAfterChargeKm)
    .filter((c) => !minPowerKw || (c.station.power_kw ?? 0) >= minPowerKw)
    // Anhängertauglichkeit hat Priorität vor einem kürzeren Umweg (§26/§27):
    // "unsuitable" wird hart ausgeschlossen, nicht nur nachrangig behandelt.
    .filter((c) => c.station.trailer_suitable !== "unsuitable");

  candidates.sort((a, b) => {
    if (preferTrailerSuitable) {
      const rank = { confirmed: 0, likely: 1, unknown: 2, unsuitable: 3 } as const;
      const diff = rank[a.station.trailer_suitable] - rank[b.station.trailer_suitable];
      if (diff !== 0) return diff;
    }
    return a.corridorDistanceKm - b.corridorDistanceKm;
  });

  const chosen = candidates[0];

  if (!chosen) {
    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      effectiveConsumptionKwhPer100km: consumption,
      effectiveRangeKm,
      chargingStopRequired: true,
      chargingStop: null,
      departureSocPercent: 100,
      arrivalSocPercent: null,
      warning:
        "Diese Strecke übersteigt die Reichweite des Gespanns, aber es wurde kein passender Ladepunkt auf der Route gefunden. Bitte Route oder Fahrzeug prüfen.",
    };
  }

  const socOnArrival = socPercentAfter(100, energyForDistance(chosen.distanceFromStartKm));

  const energyAtTarget = TARGET_SOC_AFTER_CHARGING * vehicle.battery_capacity_kwh;
  const energyOnArrival = (socOnArrival / 100) * vehicle.battery_capacity_kwh;
  const chargingTimeMin = chosen.station.power_kw
    ? Math.max(0, ((energyAtTarget - energyOnArrival) / chosen.station.power_kw) * 60)
    : null;

  // Startpunkt fuer die Restetappe: entweder der Zielladestand nach dem
  // Stopp, oder der tatsaechliche Ladestand bei Ankunft, falls dieser
  // (z. B. bei kurzer erster Etappe) bereits darueber liegt -- dann wird
  // nicht unnoetig "heruntergerechnet".
  const socAfterChargingStop = Math.max(TARGET_SOC_AFTER_CHARGING * 100, socOnArrival);
  const remainingDistanceKm = route.distanceKm - chosen.distanceFromStartKm;
  const arrivalSocPercent = socPercentAfter(
    socAfterChargingStop,
    energyForDistance(remainingDistanceKm)
  );

  return {
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    effectiveConsumptionKwhPer100km: consumption,
    effectiveRangeKm,
    chargingStopRequired: true,
    chargingStop: {
      station: chosen.station,
      distanceFromStartKm: chosen.distanceFromStartKm,
      corridorDistanceKm: chosen.corridorDistanceKm,
      socOnArrivalPercent: socOnArrival,
      chargingTimeMin,
    },
    departureSocPercent: 100,
    arrivalSocPercent,
    warning:
      chosen.station.trailer_suitable === "unknown"
        ? "Die Anhängertauglichkeit des gewählten Ladepunkts ist noch nicht von der Community bestätigt -- bitte Details prüfen."
        : null,
  };
}
