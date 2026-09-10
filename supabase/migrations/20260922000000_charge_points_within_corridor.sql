-- Fuer die Routenplanung (Nutzerwunsch: Ladestopps aus den echten
-- Ladepunkten statt der alten Demo-Tabelle public.charging_stations
-- vorschlagen, siehe src/lib/route-planning.ts): alle aktiven Ladepunkte
-- im Streckenkorridor einer Route (Puffer in Metern um die gesamte
-- Routenlinie), inkl. Position entlang der Strecke als Bruchteil
-- (0 = Start, 1 = Ziel per ST_LineLocatePoint) fuer die Ladeplanungs-
-- Reihenfolge -- bislang naeherte route-planning.ts diese Position ueber
-- den naechstgelegenen Geometriepunkt an, PostGIS berechnet sie hier
-- direkt und praeziser. Gleiches Muster wie
-- core.charge_points_within_radius (Migration 20260909040000/
-- 20260920000000), nur mit einer Linie statt einem Punkt als Referenz.
--
-- p_route_geojson: GeoJSON-LineString (lon/lat, WGS84) als Text -- vom
-- aufrufenden Code aus der OSRM-Routengeometrie gebaut. ST_SetSRID auf
-- 4326, da ST_GeomFromGeoJSON selbst keine SRID aus einfachem GeoJSON
-- uebernimmt (kein "crs"-Feld), core.charge_point.geom aber SRID 4326
-- (WGS84) ist.
--
-- Kein LIMIT wie bei der Umkreissuche: eine lange Route (mehrere hundert
-- km) braucht Kandidaten verteilt ueber die GANZE Strecke, nicht nur die
-- physisch naechstgelegenen zur Linie (die koennten sich z. B. alle in
-- einer einzelnen Stadt haeufen). ST_DWithin nutzt den vorhandenen
-- geography-Index von core.charge_point, bleibt trotzdem effizient.
create or replace function core.charge_points_within_corridor(
    p_route_geojson text,
    p_buffer_m double precision
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
    fraction_along_route double precision,
    verdict text,
    drive_through boolean
)
language sql
stable
set search_path = core, enrich, public
as $$
    with route as (
        select ST_SetSRID(ST_GeomFromGeoJSON(p_route_geojson), 4326) as line
    )
    select
        cp.id, cp.external_key, cp.name, cp.operator, cp.max_power_kw,
        ST_Y(cp.geom::geometry) as lat, ST_X(cp.geom::geometry) as lon,
        ST_Distance(cp.geom, route.line::geography) as distance_m,
        ST_LineLocatePoint(route.line, cp.geom::geometry) as fraction_along_route,
        ts.verdict, ts.drive_through
    from core.charge_point cp
    cross join route
    left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
    where cp.is_active
      and ST_DWithin(cp.geom, route.line::geography, p_buffer_m)
$$;

grant execute on function core.charge_points_within_corridor(text, double precision)
    to anon, authenticated;
