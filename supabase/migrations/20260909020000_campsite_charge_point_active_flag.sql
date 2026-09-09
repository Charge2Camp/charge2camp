-- Ermoeglicht dem Admin-Backend (admin/), Campingplaetze und Ladestationen
-- voruebergehend zu deaktivieren, ohne sie zu loeschen -- sie verschwinden
-- dadurch komplett aus der App (Liste, Suche, Karte, Detailseite gibt 404),
-- tauchen aber sofort wieder auf, sobald is_active wieder auf true gesetzt
-- wird. Kein separates "hidden"-Flag auf core.campsite_search/
-- charge_point_geo noetig -- beide Views filtern direkt auf is_active, alle
-- App-Abfragen darueber sind dadurch automatisch abgedeckt.
alter table core.campsite add column is_active boolean not null default true;
alter table core.charge_point add column is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- core.charge_point_geo: normale VIEW, Aenderungen wirken sofort ohne
-- Refresh -- nur die WHERE-Klausel ergaenzt, sonst identisch zu
-- 20260916000100_charge_point_geo_view.sql.
-- ---------------------------------------------------------------------------
drop view core.charge_point_geo;

create view core.charge_point_geo as
select
    cp.*,
    ST_Y(cp.geom::geometry) as lat,
    ST_X(cp.geom::geometry) as lon
from core.charge_point cp
where cp.is_active;

grant select on core.charge_point_geo to anon, authenticated;

-- ---------------------------------------------------------------------------
-- core.campsite_search: MATERIALIZED VIEW -- Aenderungen an core.campsite
-- wirken sich NICHT sofort aus, deshalb core.refresh_campsite_search()
-- weiter unten, die das Admin-Backend nach jeder is_active-Aenderung
-- aufruft. Nur die WHERE-Klausel ergaenzt, sonst identisch zu
-- 20260913000200_data_layer_search_view.sql.
-- ---------------------------------------------------------------------------
drop materialized view core.campsite_search;

create materialized view core.campsite_search as
select
    cs.id, cs.external_key, cs.name, cs.slug,
    cs.country_code, cs.city, cs.website,
    st_y(cs.geom::geometry) as lat,
    st_x(cs.geom::geometry) as lon,
    coalesce((select array_agg(ca.amenity_key order by ca.amenity_key)
              from core.campsite_amenity ca
              where ca.campsite_id = cs.id and ca.value_bool is true),
             '{}') as amenities,
    coalesce(ecc.has_charging,
             exists (select 1 from core.campsite_charge_link l
                     where l.campsite_id = cs.id and l.relation = 'on_site')
    ) as charging_on_site,
    ecc.max_power_kw   as on_site_power_kw,
    ecc.pitch_charging,
    ecc.charging_type,
    ecc.origin         as charging_origin,
    (select min(l.walk_distance_m) from core.campsite_charge_link l
     where l.campsite_id = cs.id and l.relation = 'walking') as nearest_walk_m,
    (select min(l.walk_distance_m)
     from core.campsite_charge_link l
     join core.charge_point cp on cp.id = l.charge_point_id
     join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
     where l.campsite_id = cs.id and ts.verdict = 'yes') as nearest_trailer_ok_m,
    (select max(cp.max_power_kw)
     from core.campsite_charge_link l
     join core.charge_point cp on cp.id = l.charge_point_id
     where l.campsite_id = cs.id and l.walk_distance_m <= 1000)
        as nearby_max_power_kw,
    (select count(*) from core.campsite_charge_link l
     where l.campsite_id = cs.id and l.relation in ('on_site','walking'))
        as charge_points_walkable
from core.campsite cs
left join enrich.campsite_charging ecc on ecc.campsite_key = cs.external_key
where cs.is_active;

create unique index idx_cssearch_id on core.campsite_search (id);
create index idx_cssearch_amen on core.campsite_search using gin (amenities);
create index idx_cssearch_geo  on core.campsite_search (lat, lon);

grant select on core.campsite_search to anon, authenticated;

-- REFRESH MATERIALIZED VIEW CONCURRENTLY braucht den o.g. eindeutigen Index
-- (bereits vorhanden) und laeuft ohne Lesesperre -- unkritisch fuer die
-- Groessenordnung dieser Tabelle (wenige tausend Zeilen), auch waehrend
-- App-Traffic sicher aufrufbar.
create or replace function core.refresh_campsite_search()
returns void
language sql
security definer
set search_path = core, public
as $$
  refresh materialized view concurrently core.campsite_search;
$$;
