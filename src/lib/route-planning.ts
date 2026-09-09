import { distanceKm } from "@/lib/geo";
import type { LatLng, RouteResult } from "@/lib/providers/routing/types";
import type { ChargingStation, Vehicle } from "@/types/database";

/**
 * Regelbasierte Mehrstopp-Ladeplanung (§21, §26), angelehnt an gängige
 * EV-Routenplaner (z. B. A Better Routeplanner): SOC-Zielwerte fuer
 * Abfahrt, Ankunft an einem Ladestopp, Ziel-Ladestand nach dem Laden und
 * Ankunft am Ziel sind Eingaben des Nutzers, keine internen Annahmen.
 * Schwellwerte/Defaults zentral und leicht anpassbar. Plant iterativ so
 * viele Ladestopps wie noetig (nicht nur einen): von der aktuellen
 * Position/SOC aus wird jeweils der naechste erreichbare, moeglichst
 * anhaengertaugliche Ladepunkt gesucht, bis das Ziel direkt erreichbar ist.
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

// Sicherheitsgrenze gegen pathologische Konfigurationen (z. B. sehr geringe
// Reichweite + sehr viele, dicht beieinanderliegende Ladepunkte) -- eine
// reale Reise braucht praktisch nie mehr Stopps als das.
const MAX_CHARGING_STOPS = 8;

/** Maximale Anzahl an Alternativ-Vorschlaegen pro Ladestopp (Uebersichtlichkeit im UI). */
const MAX_ALTERNATIVES = 5;

export interface ChargingStopCandidate {
  station: ChargingStation;
  distanceFromStartKm: number;
  /** Naeherungsweise Distanz der Ladesaeule von der Route (Umweg-Proxy). */
  corridorDistanceKm: number;
  /**
   * Persoenliche Eignungseinschaetzung fuer das Gespann des Nutzers (§20),
   * basierend auf Community-Bewertungen dieses Ladepunkts. Wird von
   * planTrip NICHT berechnet (erfordert charging_reviews aus der DB) --
   * die aufrufende Server-Action reichert Kandidaten damit nachtraeglich an.
   */
  personalCompatibility?: import("./scoring/trailer-compatibility").PersonalCompatibility | null;
  /**
   * Datum der letzten Community-Bewertung dieses Ladepunkts (als Proxy fuer
   * "zuletzt bestaetigt funktionsfaehig", da kein Live-Status verfuegbar
   * ist, siehe §39/Phase 8). Wie personalCompatibility erst von der
   * aufrufenden Server-Action gesetzt.
   */
  lastConfirmedAt?: string | null;
}

export interface ChargingStopPlan extends ChargingStopCandidate {
  socOnArrivalPercent: number;
  chargingTimeMin: number | null;
  /** Weitere Kandidaten fuer DIESEN Stopp im Streckenkorridor (gleiche Sortierung: Anhaengertauglichkeit vor Umweg), zur Anzeige als Alternativen. */
  alternatives: ChargingStopCandidate[];
}

export interface TripPlan {
  distanceKm: number;
  durationMin: number;
  effectiveConsumptionKwhPer100km: number;
  effectiveRangeKm: number;
  chargingStopsRequired: boolean;
  /** Ladestopps in Fahrtreihenfolge (leer, wenn das Ziel direkt erreichbar ist). */
  chargingStops: ChargingStopPlan[];
  departureSocPercent: number;
  /** null, wenn das Ziel mit den aktuellen Ladestopps/Einstellungen nicht erreichbar ist. */
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

/** Naeherungsweise Distanz (km) eines beliebigen Punkts entlang der Route
 * ab Streckenanfang -- z. B. fuer manuell hinzugefuegte Zwischenstopps, die
 * (anders als Ladepunkt-Kandidaten) nicht Teil der Ladeplanung sind, aber
 * fuer die Reihenfolge in der Routenuebersicht einsortiert werden muessen. */
export function distanceAlongRouteKm(point: LatLng, route: Pick<RouteResult, "geometry" | "distanceKm">): number {
  const nearest = nearestPointOnRoute(point, route.geometry);
  return cumulativeDistanceAtIndex(nearest.index, route.geometry.length, route.distanceKm);
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
  preferredProvider,
  excludedStationIds = [],
  forcedStationIdByIndex = {},
}: {
  route: RouteResult;
  vehicle: Pick<Vehicle, "battery_capacity_kwh">;
  chargingStations: ChargingStation[];
  preferTrailerSuitable?: boolean;
  minPowerKw?: number;
  /** Nur Ladepunkte dieses Anbieters (z. B. "IONITY") als Kandidaten zulassen, sofern gesetzt. */
  preferredProvider?: string;
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
  /** Vom Nutzer per "Loeschen" ausgeschlossene Ladepunkt-IDs -- werden bei der Kandidatensuche an JEDEM Stopp uebersprungen. */
  excludedStationIds?: string[];
  /** Nutzer hat fuer den Stopp mit diesem Index (0-basiert, Fahrtreihenfolge) explizit eine Alternative gewaehlt. */
  forcedStationIdByIndex?: Record<number, string>;
}): TripPlan {
  const consumption = consumptionKwhPer100km;
  const effectiveRangeKm = (vehicle.battery_capacity_kwh / consumption) * 100;

  const energyForDistance = (km: number) => (km * consumption) / 100;
  const socPercentAfter = (startSocPercent: number, energyUsedKwh: number) =>
    Math.max(0, startSocPercent - (energyUsedKwh / vehicle.battery_capacity_kwh) * 100);

  // Streckenkorridor-Position (Naeherung, s. o.) fuer alle Ladepunkte einmal
  // vorab berechnen -- wird an jedem Stopp wiederverwendet.
  const stationsWithPosition = chargingStations.map((station) => {
    const nearest = nearestPointOnRoute(station, route.geometry);
    return {
      station,
      corridorDistanceKm: nearest.distanceKm,
      distanceFromStartKm: cumulativeDistanceAtIndex(nearest.index, route.geometry.length, route.distanceKm),
    };
  });

  const stops: ChargingStopPlan[] = [];
  const usedStationIds = new Set<string>();
  let currentDistanceKm = 0;
  let currentSocPercent = departureSocPercent;
  let warning: string | null = null;

  while (true) {
    const remainingDistanceKm = route.distanceKm - currentDistanceKm;
    const directRangeKm = rangeBetweenSoc(effectiveRangeKm, currentSocPercent, minSocAtDestinationPercent);

    // Von hier aus ist das Ziel direkt erreichbar -- fertig.
    if (remainingDistanceKm <= directRangeKm) break;

    if (stops.length >= MAX_CHARGING_STOPS) {
      warning = `Diese Strecke wuerde mehr als ${MAX_CHARGING_STOPS} Ladestopps benoetigen -- bitte Reichweite, Verbrauch oder Ladeeinstellungen pruefen.`;
      return {
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        effectiveConsumptionKwhPer100km: consumption,
        effectiveRangeKm,
        chargingStopsRequired: true,
        chargingStops: stops,
        departureSocPercent,
        arrivalSocPercent: null,
        warning,
      };
    }

    const rangeToStopKm = rangeBetweenSoc(effectiveRangeKm, currentSocPercent, minSocAtStopPercent);

    // Kandidaten fuer DIESEN Stopp: noch nicht auf dieser Route verwendet,
    // vom Nutzer nicht geloescht, vor uns liegend und von der aktuellen
    // Position aus mit dem aktuellen Ladestand erreichbar.
    const candidates = stationsWithPosition
      .filter((c) => !usedStationIds.has(c.station.id))
      .filter((c) => !excludedStationIds.includes(c.station.id))
      .filter((c) => c.corridorDistanceKm <= detourToleranceKm)
      .filter((c) => c.distanceFromStartKm > currentDistanceKm)
      .filter((c) => c.distanceFromStartKm - currentDistanceKm <= rangeToStopKm)
      .filter((c) => !minPowerKw || (c.station.power_kw ?? 0) >= minPowerKw)
      .filter((c) => !preferredProvider || c.station.provider === preferredProvider)
      // Anhängertauglichkeit hat Priorität vor einem kürzeren Umweg (§26/§27):
      // "unsuitable" wird hart ausgeschlossen, nicht nur nachrangig behandelt.
      .filter((c) => c.station.trailer_suitable !== "unsuitable");

    candidates.sort((a, b) => {
      if (preferTrailerSuitable) {
        // Reihenfolge folgt NICHT der Buchstaben-/Konfidenz-Anmutung von
        // "confirmed" vs. "likely", sondern der Gespann-Freundlichkeit der
        // Kartenpins, auf die trailer-suitability.ts (TRAILER_SUITABILITY_
        // ICON_SRC) diese vier Rohzustaende abbildet: "likely" steht dort
        // fuer den Drive-Through-Pin (durchfahren, kein Rangieren noetig --
        // der beste Fall laut docs/design/brand-guide.md Abschnitt 7),
        // "confirmed" fuer den Pin "ohne Abkoppeln" (Stellplatz vorhanden,
        // muss aber rangiert werden) -- Drive-Through steht deshalb hier
        // bewusst vor "confirmed".
        const rank = { likely: 0, confirmed: 1, unknown: 2, unsuitable: 3 } as const;
        const diff = rank[a.station.trailer_suitable] - rank[b.station.trailer_suitable];
        if (diff !== 0) return diff;
      }
      return a.corridorDistanceKm - b.corridorDistanceKm;
    });

    const forcedStationId = forcedStationIdByIndex[stops.length];
    const chosen = forcedStationId
      ? candidates.find((c) => c.station.id === forcedStationId)
      : candidates[0];

    if (!chosen) {
      warning = forcedStationId
        ? "Der gewählte Ladepunkt ist mit den aktuellen Einstellungen nicht erreichbar (außerhalb der Reichweite, Umweg-Toleranz oder Mindest-Ladeleistung). Bitte Einstellungen prüfen."
        : `Diese Strecke übersteigt die Reichweite des Gespanns${stops.length > 0 ? ` nach ${stops.length}. Ladestopp` : ""}, aber es wurde kein passender Ladepunkt auf der Route gefunden (ggf. Umweg-Toleranz erhöhen). Bitte Route, Fahrzeug oder Einstellungen prüfen.`;
      return {
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        effectiveConsumptionKwhPer100km: consumption,
        effectiveRangeKm,
        chargingStopsRequired: true,
        chargingStops: stops,
        departureSocPercent,
        arrivalSocPercent: null,
        warning,
      };
    }

    const alternatives: ChargingStopCandidate[] = candidates
      .filter((c) => c.station.id !== chosen.station.id)
      .slice(0, MAX_ALTERNATIVES)
      .map(({ station, distanceFromStartKm, corridorDistanceKm }) => ({
        station,
        distanceFromStartKm,
        corridorDistanceKm,
      }));

    const distanceTraveledKm = chosen.distanceFromStartKm - currentDistanceKm;
    const socOnArrival = socPercentAfter(currentSocPercent, energyForDistance(distanceTraveledKm));

    const energyAtTarget = (targetSocAfterChargingPercent / 100) * vehicle.battery_capacity_kwh;
    const energyOnArrival = (socOnArrival / 100) * vehicle.battery_capacity_kwh;
    const energyChargedKwh = Math.max(0, energyAtTarget - energyOnArrival);
    const chargingTimeMin = chosen.station.power_kw
      ? Math.max(0, (energyChargedKwh / chosen.station.power_kw) * 60)
      : null;

    if (!warning && chosen.station.trailer_suitable === "unknown") {
      warning =
        "Die Anhängertauglichkeit mindestens eines vorgeschlagenen Ladepunkts ist noch nicht von der Community bestätigt -- bitte Details prüfen.";
    }

    stops.push({
      station: chosen.station,
      distanceFromStartKm: chosen.distanceFromStartKm,
      corridorDistanceKm: chosen.corridorDistanceKm,
      socOnArrivalPercent: socOnArrival,
      chargingTimeMin,
      alternatives,
    });

    usedStationIds.add(chosen.station.id);
    currentDistanceKm = chosen.distanceFromStartKm;
    // Startpunkt fuer die naechste Etappe: entweder der Zielladestand nach
    // dem Stopp, oder der tatsaechliche Ladestand bei Ankunft, falls dieser
    // (z. B. bei kurzer Etappe) bereits darueber liegt -- dann wird nicht
    // unnoetig "heruntergerechnet".
    currentSocPercent = Math.max(targetSocAfterChargingPercent, socOnArrival);
  }

  const remainingDistanceKm = route.distanceKm - currentDistanceKm;
  const arrivalSocPercent = socPercentAfter(currentSocPercent, energyForDistance(remainingDistanceKm));

  return {
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    effectiveConsumptionKwhPer100km: consumption,
    effectiveRangeKm,
    chargingStopsRequired: stops.length > 0,
    chargingStops: stops,
    departureSocPercent,
    arrivalSocPercent,
    warning,
  };
}
