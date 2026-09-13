import { distanceKm } from "@/lib/geo";
import type { LatLng, RouteResult } from "@/lib/providers/routing/types";
import type { Vehicle } from "@/types/database";
import type { TrailerPinState } from "@/lib/trailer-verdict";
import { operatorMatchesAnyProvider } from "@/lib/charging-providers";

/** Ladepunkt-Kandidat fuer die Routenplanung -- gebaut aus echten
 * Ladepunkten (core.charge_point, ueber die PostGIS-Korridorsuche
 * core.charge_points_within_corridor, siehe routenplaner/actions.ts)
 * statt der fruehe verwendeten Demo-Tabelle public.charging_stations.
 * `trailerPinState` uebernimmt bewusst die App-weite 5-stufige Skala aus
 * src/lib/trailer-verdict.ts (dieselbe wie auf den Ladepunkt-Kartenpins),
 * statt der alten, nur fuer die Demo-Daten gueltigen 4-stufigen
 * TrailerSuitability. */
export interface RouteChargingStation {
  id: string;
  name: string | null;
  provider: string;
  latitude: number;
  longitude: number;
  power_kw: number | null;
  trailerPinState: TrailerPinState;
}

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

// Standard-Mindestladeleistung im Routenplaner-Formular (Nutzerwunsch) --
// deckt die meisten heutigen Schnelllader-Standorte ab, ohne bei Bedarf
// (z. B. abgelegenere Ziele) zu restriktiv zu sein; ueberschreibbar.
export const DEFAULT_MIN_POWER_KW = 100;

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

/** Positionsfenster (km entlang der Strecke), innerhalb dessen zwei
 * Kandidaten als "aehnlich gut positioniert" gelten -- erst innerhalb
 * dieses Fensters entscheidet ein bevorzugter Anbieter ueber die Wahl
 * (siehe candidates.sort in planTrip). Verhindert, dass ein nahegelegener
 * bevorzugter Ladepunkt einen deutlich besser positionierten (mehr
 * Reichweite ausnutzenden) anderen Ladepunkt verdraengt. */
const PREFERRED_PROVIDER_PROXIMITY_KM = 15;

export interface ChargingStopCandidate {
  station: RouteChargingStation;
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
  /** Ladestand, bis zu dem an diesem Stopp geladen wird, bevor es weitergeht
   * -- i. d. R. targetSocAfterChargingPercent, aber nie WENIGER als der
   * ohnehin schon vorhandene Ladestand bei Ankunft (siehe currentSocPercent-
   * Berechnung unten: kurze Etappen brauchen dann gar kein/kaum Nachladen). */
  socAfterChargingPercent: number;
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

// Ladeplanung ruft nearestPointOnRoute einmal PRO Ladepunkt-Kandidat auf
// (siehe stationsWithPosition in planTrip) -- ohne Begrenzung waere das
// O(Kandidaten x Geometriepunkte), bei langen Strecken mit tausenden
// OSRM-Geometriepunkten und hunderten Kandidaten im Korridor spuerbar
// langsam (Performance-Review). Gleiches Downsampling-Prinzip wird bereits
// fuer die Overpass-Strassenrestriktions-Abfrage genutzt (dort auf max. 120
// Punkte, aus Ruecksicht auf den geteilten oeffentlichen Dienst) -- hier
// grosszuegiger, da rein lokale Berechnung ohne externes Rate-Limit; 2000
// Punkte sind fuer die ohnehin nur naeherungsweise Positionsbestimmung
// (gleichmaessige Punktverteilung angenommen, siehe cumulativeDistanceAtIndex)
// weit mehr als noetig.
const MAX_POSITIONING_GEOMETRY_POINTS = 2000;

/** Reduziert eine Streckengeometrie gleichmaessig auf hoechstens
 * `maxPoints` Punkte (Start-/Endpunkt bleiben immer erhalten). Rein
 * lokale Performance-Optimierung fuer nearestPointOnRoute -- veraendert
 * NICHT die zurueckgegebene Route/Geometrie selbst (die bleibt
 * unangetastet, z. B. fuer die Kartendarstellung), nur die interne
 * Positionsbestimmung der Ladepunkt-Kandidaten nutzt die verkleinerte
 * Kopie. */
function downsampleGeometry(geometry: LatLng[], maxPoints: number): LatLng[] {
  if (geometry.length <= maxPoints) return geometry;
  const step = (geometry.length - 1) / (maxPoints - 1);
  const result: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(geometry[Math.round(i * step)]);
  }
  return result;
}

/** Naeherungsweise Distanz (km) eines beliebigen Punkts entlang der Route
 * ab Streckenanfang -- z. B. fuer manuell hinzugefuegte Zwischenstopps, die
 * (anders als Ladepunkt-Kandidaten) nicht Teil der Ladeplanung sind, aber
 * fuer die Reihenfolge in der Routenuebersicht einsortiert werden muessen. */
export function distanceAlongRouteKm(point: LatLng, route: Pick<RouteResult, "geometry" | "distanceKm">): number {
  const geometry = downsampleGeometry(route.geometry, MAX_POSITIONING_GEOMETRY_POINTS);
  const nearest = nearestPointOnRoute(point, geometry);
  return cumulativeDistanceAtIndex(nearest.index, geometry.length, route.distanceKm);
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
  preferredProviders = [],
  avoidedProviders = [],
  excludedStationIds = [],
  forcedStationIdByIndex = {},
}: {
  route: RouteResult;
  vehicle: Pick<Vehicle, "battery_capacity_kwh">;
  chargingStations: RouteChargingStation[];
  preferTrailerSuitable?: boolean;
  minPowerKw?: number;
  /** Nur Ladepunkte dieser Anbieter (Schluessel aus charging-providers.ts,
   * z. B. "ionity") als Kandidaten zulassen -- leeres Array = kein Filter. */
  preferredProviders?: string[];
  /** Anbieter (Schluessel aus charging-providers.ts), die NIE als Kandidat
   * infrage kommen sollen (z. B. "nie Tesla einplanen") -- hartes Ausschluss-
   * kriterium, unabhaengig von preferredProviders. */
  avoidedProviders?: string[];
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
  // vorab berechnen -- wird an jedem Stopp wiederverwendet. Downsampling
  // (s. o.) haelt das bei sehr langen Routen mit vielen Kandidaten schnell,
  // ohne die zurueckgegebene route.geometry selbst zu veraendern.
  const positioningGeometry = downsampleGeometry(route.geometry, MAX_POSITIONING_GEOMETRY_POINTS);
  const stationsWithPosition = chargingStations.map((station) => {
    const nearest = nearestPointOnRoute(station, positioningGeometry);
    return {
      station,
      corridorDistanceKm: nearest.distanceKm,
      distanceFromStartKm: cumulativeDistanceAtIndex(nearest.index, positioningGeometry.length, route.distanceKm),
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
      // Vermiedene Anbieter (und dauerhaft blockierte Ladepunkte, siehe
      // excludedStationIds oben) sind ein hartes Ausschlusskriterium --
      // bevorzugte Anbieter dagegen NICHT: siehe Sortierung unten. Ein
      // harter Filter auf preferredProviders wuerde sonst eine Etappe
      // unloesbar machen, sobald in der Naehe zufaellig kein Ladepunkt
      // eines bevorzugten Anbieters liegt (Nutzerwunsch: "wenn es keinen
      // Ladepunkt der bevorzugten Anbieter gibt, soll mit einer
      // verfuegbaren Option geplant werden").
      .filter((c) => avoidedProviders.length === 0 || !operatorMatchesAnyProvider(c.station.provider, avoidedProviders))
      // Anhängertauglichkeit hat Priorität vor einem kürzeren Umweg (§26/§27):
      // "nicht_tauglich" wird hart ausgeschlossen, nicht nur nachrangig
      // behandelt.
      .filter((c) => c.station.trailerPinState !== "nicht_tauglich");

    candidates.sort((a, b) => {
      if (preferTrailerSuitable) {
        // Reihenfolge folgt der Gespann-Freundlichkeit der Kartenpins
        // (docs/design/brand-guide.md Abschnitt 7, src/lib/trailer-verdict.ts
        // TrailerPinState): Drive-Through (durchfahren, kein Rangieren
        // noetig) vor "ohne Abkoppeln" (Stellplatz vorhanden, muss aber
        // rangiert werden) vor "bedingt tauglich" (nur abgekoppelt
        // erreichbar) vor "ungeprueft".
        const rank: Record<TrailerPinState, number> = {
          drive_through: 0,
          ohne_abkoppeln: 1,
          bedingt_tauglich: 2,
          ungeprueft: 3,
          nicht_tauglich: 4,
        };
        const diff = rank[a.station.trailerPinState] - rank[b.station.trailerPinState];
        if (diff !== 0) return diff;
      }
      // Reichweite moeglichst ausnutzen: unter etwa gleich geeigneten
      // Kandidaten den am weitesten entfernten (naeher an rangeToStopKm)
      // bevorzugen, nicht einfach den erstbesten in Streckennaehe. Ohne
      // dieses Kriterium wurde hier zuvor rein nach corridorDistanceKm
      // sortiert, wodurch ein Ladepunkt direkt an der Route kurz nach der
      // Abfahrt/dem letzten Stopp gewaehlt werden konnte, obwohl mit dem
      // aktuellen Ladestand noch ein Vielfaches der Strecke moeglich
      // gewesen waere -- Stopps lagen dadurch teils nur ~20 km auseinander
      // statt die Reichweite auszunutzen (Nutzerfeedback). Bewusst VOR der
      // Anbieter-Vorliebe geprueft (s. u.): ein bevorzugter Anbieter darf
      // nicht dazu fuehren, dass unnoetig viel Reichweite verschenkt wird
      // (z. B. ein nahegelegener bevorzugter Ladepunkt statt eines viel
      // besser positionierten anderen) -- innerhalb eines "aehnlich guten"
      // Positionsfensters (PREFERRED_PROVIDER_PROXIMITY_KM) entscheidet
      // dagegen sehr wohl der bevorzugte Anbieter.
      const distanceDiff = b.distanceFromStartKm - a.distanceFromStartKm;
      if (Math.abs(distanceDiff) > PREFERRED_PROVIDER_PROXIMITY_KM) return distanceDiff;

      // Bevorzugte Anbieter vorziehen (Nutzerwunsch) -- als weiches
      // Kriterium: bei etwa gleich guter Position gewinnt der bevorzugte
      // Anbieter, ohne dass ein Kandidat eines anderen Anbieters deswegen
      // komplett ausgeschlossen wird (siehe Filter oben) oder unnoetig viel
      // Reichweite verschenkt wird (s. o.).
      if (preferredProviders.length > 0) {
        const aPreferred = operatorMatchesAnyProvider(a.station.provider, preferredProviders);
        const bPreferred = operatorMatchesAnyProvider(b.station.provider, preferredProviders);
        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
      }
      if (Math.abs(distanceDiff) > 0.001) return distanceDiff;
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
    // Zielladestand fuer die naechste Etappe: entweder der eingestellte
    // Zielladestand, oder der tatsaechliche Ladestand bei Ankunft, falls
    // dieser (z. B. bei kurzer Etappe) bereits darueber liegt -- dann wird
    // nicht unnoetig "heruntergerechnet" bzw. gar nicht geladen.
    const socAfterCharging = Math.max(targetSocAfterChargingPercent, socOnArrival);

    if (!warning && chosen.station.trailerPinState === "ungeprueft") {
      warning =
        "Die Anhängertauglichkeit mindestens eines vorgeschlagenen Ladepunkts ist noch nicht von der Community bestätigt -- bitte Details prüfen.";
    }

    stops.push({
      station: chosen.station,
      distanceFromStartKm: chosen.distanceFromStartKm,
      corridorDistanceKm: chosen.corridorDistanceKm,
      socOnArrivalPercent: socOnArrival,
      socAfterChargingPercent: socAfterCharging,
      chargingTimeMin,
      alternatives,
    });

    usedStationIds.add(chosen.station.id);
    currentDistanceKm = chosen.distanceFromStartKm;
    currentSocPercent = socAfterCharging;
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
