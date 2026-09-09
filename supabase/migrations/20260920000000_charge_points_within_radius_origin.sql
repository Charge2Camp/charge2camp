-- Fuer die neue Bewertungs-Vertrauens-Unterscheidung (Noch nicht bewertet /
-- Von der Community bewertet / Geprueft, siehe src/lib/trailer-verdict.ts
-- getReviewState()) braucht die Campingplatz-Detailseite auch fuer die per
-- Umkreissuche eingemischten Ladepunkte (core.charge_points_within_radius,
-- Migration 20260909040000) die Herkunft der Anhaengertauglichkeits-Angabe
-- (enrich.trailer_suitability.origin), nicht nur den Verdict.
--
-- Aendert die Rueckgabespalten der Funktion -- CREATE OR REPLACE FUNCTION
-- erlaubt das in Postgres nicht (nur identische Signaturen), daher DROP +
-- CREATE.
drop function core.charge_points_within_radius(double precision, double precision, double precision);

create function core.charge_points_within_radius(
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
    order by distance_m
    limit 200
$$;

grant execute on function core.charge_points_within_radius(double precision, double precision, double precision)
    to anon, authenticated;
