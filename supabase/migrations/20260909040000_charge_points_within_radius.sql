-- Fuer die Campingplatz-Detailseite: alle Ladestationen im Umkreis (z. B.
-- 25 km) eines Punkts, inkl. Anhaengertauglichkeit fuer die Kartenpins --
-- anders als core.campsite_charge_link (von ingest/build_links.py
-- vorberechnete Fusswege-Verknuepfung, nur wenige Meter/Gehminuten) ein
-- echter Umkreis-Radius per PostGIS, live berechnet.
--
-- security invoker (Standard) reicht -- core.charge_point/enrich.
-- trailer_suitability haben bereits eine "readable by everyone"-RLS-Policy
-- fuer anon/authenticated (siehe 20260915000000_data_layer_api_exposure.sql),
-- keine erhoehten Rechte noetig.
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
    drive_through boolean
)
language sql
stable
set search_path = core, enrich, public
as $$
    select
        cp.id, cp.external_key, cp.name, cp.operator, cp.max_power_kw,
        ST_Y(cp.geom::geometry) as lat, ST_X(cp.geom::geometry) as lon,
        ST_Distance(cp.geom, ST_MakePoint(p_lon, p_lat)::geography) as distance_m,
        ts.verdict, ts.drive_through
    from core.charge_point cp
    left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
    where cp.is_active
      and ST_DWithin(cp.geom, ST_MakePoint(p_lon, p_lat)::geography, p_radius_m)
    order by distance_m
    limit 200
$$;

grant execute on function core.charge_points_within_radius(double precision, double precision, double precision)
    to anon, authenticated;
