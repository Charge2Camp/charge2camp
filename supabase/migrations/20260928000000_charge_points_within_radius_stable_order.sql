-- Bugreport (Routenplaner, Tab 2): Eine Alternative, die gerade noch als
-- waehlbar angezeigt wurde, galt nach der Auswahl ploetzlich als "ausserhalb
-- der Reichweite/Umweg-Toleranz/Mindest-Ladeleistung" -- obwohl sich an den
-- Einstellungen nichts geaendert hatte (replanChargingStop in
-- routenplaner/actions.ts fragt exakt dieselbe Streckengeometrie/denselben
-- Umkreis erneut ab, siehe fetchCorridorChargingStations).
--
-- Ursache: `order by distance_m` ohne zweites Sortierkriterium ist bei
-- EXAKT gleich weit entfernten Ladepunkten (z. B. zwei Datensaetze fuer
-- denselben physischen Standort -- kommt in den importierten Ladepunkt-
-- Daten vor) in Postgres NICHT stabil/deterministisch ueber mehrere
-- Ausfuehrungen hinweg (Ausfuehrungsplan/Parallel-Worker koennen die
-- Reihenfolge bei Ties aendern). Das `limit 200` je Streckenpunkt (siehe
-- core.charge_points_within_radius, Migration 20260909040000/20260920000000)
-- konnte dadurch bei vielen Ladepunkten in einem Bereich (z. B. dichte
-- Tourismusregionen) beim zweiten Aufruf (Neuplanung nach Loeschen/
-- Alternative-Wahl) einen anderen, leicht abweichenden Satz an Kandidaten
-- liefern als beim ersten Aufruf -- die planTrip-Ladeplanung (route-
-- planning.ts) ist reine, deterministische Berechnung ueber genau diese
-- Kandidatenliste, reagiert also empfindlich auf eine solche Verschiebung.
--
-- Fix: `cp.id` als zweites, eindeutiges Sortierkriterium -- garantiert eine
-- bei jedem Aufruf IDENTISCHE Reihenfolge (und damit denselben `limit 200`-
-- Ausschnitt) fuer dieselbe Anfrage. Nur die ORDER BY-Klausel aendert sich,
-- die Rueckgabespalten bleiben gleich -- CREATE OR REPLACE genuegt hier
-- (kein DROP + CREATE noetig).
create or replace function core.charge_points_within_radius(
    p_lat double precision,
    p_lon double precision,
    p_radius_m double precision
)
returns table (
    id uuid,
    external_key text,
    name text,
    operator text,
    max_power_kw numeric,
    lat double precision,
    lon double precision,
    distance_m double precision,
    verdict text,
    drive_through boolean,
    trailer_origin text
)
language sql
stable
set search_path = core, enrich, public
as $$
    select
        cp.id, cp.external_key, cp.name, cp.operator, cp.max_power_kw,
        ST_Y(cp.geom::geometry) as lat, ST_X(cp.geom::geometry) as lon,
        ST_Distance(cp.geom, ST_MakePoint(p_lon, p_lat)::geography) as distance_m,
        ts.verdict, ts.drive_through, ts.origin as trailer_origin
    from core.charge_point cp
    left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
    where cp.is_active
      and ST_DWithin(cp.geom, ST_MakePoint(p_lon, p_lat)::geography, p_radius_m)
    order by distance_m, cp.id
    limit 200
$$;
