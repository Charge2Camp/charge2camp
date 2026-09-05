import { distanceKm } from "@/lib/geo";
import type { LatLng, RouteResult } from "@/lib/providers/routing/types";
import type { ChargingStation, Vehicle } from "@/types/database";

/**
 * Regelbasierte "erste Ladeplanung" (§21, §26), angelehnt an gängige
 * EV-Routenplaner (z. B. A Better Routeplanner): SOC-Zielwerte fuer
 * Abfahrt, Ankunft am Ladestopp, Ziel-Ladestand nach dem Laden und
 * Ankunft am Ziel sind Eingaben des Nutzers, keine internen Annahmen.
 * Schwellwerte/Defaults zentral und leicht anpassbar. Plant fuer den MVP
 * genau EINEN Ladestopp (kein Mehrstopp-Optimierer) -- ausreichend fuer
 * die meisten Strecken innerhalb der Reichweite eines modernen E-Autos.
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

// Standardwerte fuer die SOC-Eingaben (Nutzer kann jeden Wert im
// Routenplaner-Formular ueberschreiben).
export const DEFAULT_DEPARTURE_SOC_PERCENT = 100;
export const DEFAULT_MIN_SOC_AT_STOP_PERCENT = 15;
export const DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT = 20;
export const DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT = 80;

// Umweg-Toleranz: wie viele zusaetzliche km ist der Nutzer bereit zu
// fahren, um statt des naechstgelegenen einen anhaengertauglicheren
// Ladepunkt anzusteuern (Schieberegler 0-100 km im Formular).
export const DEFAULT_DETOUR_TOLERANCE_KM = 20;
export const MAX_DETOUR_TOLERANCE_KM = 100;

export interface TripPlan {
  distanceKm: number;
  durationMin: number;
  effectiveConsumptionKwhPer100km: number;
  effectiveRangeKm: number;
  chargingStopRequired: boolean;
  chargingStop: {
    station: ChargingStation;
    distanceFromStartKm: number;
    /** Naeherungsweise Distanz der Ladesaeule von der Route (Umweg-Proxy). */
    corridorDistanceKm: number;
    socOnArrivalPercent: number;
    chargingTimeMin: number | null;
  } | null;
  departureSocPercent: number;
  arrivalSocPercent: number | null;
  warning: string | null;
}

/** Reichweite (km), die zwischen zwei Ladestaenden (in %) zur Verfuegung
 * steht, gegeben die effektive Gesamtreichweite bei 100 % -> 0 %. */
function rangeBetweenSoc(effectiveRangeKm: number, fromSocPercent: number, toSocPercent: number) {
  return Math.max(0, effectiveRangeKm * ((fromSocPercent - toSocPercent) / 100));
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
  departureSocPercent = DEFAULT_DEPARTURE_SOC_PERCENT,
  minSocAtStopPercent = DEFAULT_MIN_SOC_AT_STOP_PERCENT,
  minSocAtDestinationPercent = DEFAULT_MIN_SOC_AT_DESTINATION_PERCENT,
  targetSocAfterChargingPercent = DEFAULT_TARGET_SOC_AFTER_CHARGING_PERCENT,
  detourToleranceKm = DEFAULT_DETOUR_TOLERANCE_KM,
}: {
  route: RouteResult;
  vehicle: Pick<Vehicle, "battery_capacity_kwh">;
  chargingStations: ChargingStation[];
  preferTrailerSuitable?: boolean;
  minPowerKw?: number;
  /** Bereits aufgeloester Verbrauch (manuell > Profil > Standard), siehe Modul-Kommentar. */
  consumptionKwhPer100km: number;
  /** Ladestand bei Abfahrt in %. */
  departureSocPercent?: number;
  /** Mindest-Ladestand, mit dem an einem Zwischen-Ladestopp angekommen werden soll. */
  minSocAtStopPercent?: number;
  /** Mindest-Ladestand, mit dem am Ziel angekommen werden soll. */
  minSocAtDestinationPercent?: number;
  /** Ladestand, auf den an einem Ladestopp aufgeladen wird. */
  targetSocAfterChargingPercent?: number;
  /** Zusaetzliche km, die fuer einen anhaengertauglicheren Ladepunkt in Kauf genommen werden. */
  detourToleranceKm?: number;
}): TripPlan {
  const consumption = consumptionKwhPer100km;
  const effectiveRangeKm = (vehicle.battery_capacity_kwh / consumption) * 100;

  const energyForDistance = (km: number) => (km * consumption) / 100;
  const socPercentAfter = (startSocPercent: number, energyUsedKwh: number) =>
    Math.max(0, startSocPercent - (energyUsedKwh / vehicle.battery_capacity_kwh) * 100);

  const directRangeKm = rangeBetweenSoc(effectiveRangeKm, departureSocPercent, minSocAtDestinationPercent);

  // Kein Ladestopp noetig.
  if (route.distanceKm <= directRangeKm) {
    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      effectiveConsumptionKwhPer100km: consumption,
      effectiveRangeKm,
      chargingStopRequired: false,
      chargingStop: null,
      departureSocPercent,
      arrivalSocPercent: socPercentAfter(departureSocPercent, energyForDistance(route.distanceKm)),
      warning: null,
    };
  }

  const rangeToStopKm = rangeBetweenSoc(effectiveRangeKm, departureSocPercent, minSocAtStopPercent);
  const rangeFromStopKm = rangeBetweenSoc(
    effectiveRangeKm,
    targetSocAfterChargingPercent,
    minSocAtDestinationPercent
  );

  // Ladestopp noetig: Kandidaten im Streckenkorridor suchen. Die
  // Korridor-Distanz (Abstand der Ladesaeule von der Streckengeometrie)
  // dient als Naeherung fuer den Umweg -- eine echte Neuberechnung der
  // Route ueber die Ladesaeule waere fuer den MVP zu aufwaendig.
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
    .filter((c) => c.corridorDistanceKm <= detourToleranceKm)
    .filter((c) => c.distanceFromStartKm <= rangeToStopKm)
    // von dort auch das Ziel erreichbar -- nach dem Stopp steht nur die auf
    // targetSocAfterChargingPercent begrenzte Reichweite zur Verfuegung.
    .filter((c) => route.distanceKm - c.distanceFromStartKm <= rangeFromStopKm)
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
      departureSocPercent,
      arrivalSocPercent: null,
      warning:
        "Diese Strecke übersteigt die Reichweite des Gespanns, aber es wurde kein passender Ladepunkt auf der Route gefunden (ggf. Umweg-Toleranz erhöhen). Bitte Route, Fahrzeug oder Einstellungen prüfen.",
    };
  }

  const socOnArrival = socPercentAfter(departureSocPercent, energyForDistance(chosen.distanceFromStartKm));

  const energyAtTarget = (targetSocAfterChargingPercent / 100) * vehicle.battery_capacity_kwh;
  const energyOnArrival = (socOnArrival / 100) * vehicle.battery_capacity_kwh;
  const chargingTimeMin = chosen.station.power_kw
    ? Math.max(0, ((energyAtTarget - energyOnArrival) / chosen.station.power_kw) * 60)
    : null;

  // Startpunkt fuer die Restetappe: entweder der Zielladestand nach dem
  // Stopp, oder der tatsaechliche Ladestand bei Ankunft, falls dieser
  // (z. B. bei kurzer erster Etappe) bereits darueber liegt -- dann wird
  // nicht unnoetig "heruntergerechnet".
  const socAfterChargingStop = Math.max(targetSocAfterChargingPercent, socOnArrival);
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
    departureSocPercent,
    arrivalSocPercent,
    warning:
      chosen.station.trailer_suitable === "unknown"
        ? "Die Anhängertauglichkeit des gewählten Ladepunkts ist noch nicht von der Community bestätigt -- bitte Details prüfen."
        : null,
  };
}
