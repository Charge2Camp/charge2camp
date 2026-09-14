-- Lesesicht fuer App und Suchindex (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt
-- 5.3). Fasst core.campsite mit Merkmalen, eigener Recherche
-- (enrich.campsite_charging) und der vorberechneten Ladepunkt-Verknuepfung
-- zu einem suchbaren Dokument zusammen.
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
    -- Laden auf dem Platz: eigene Recherche hat Vorrang vor OSM-Ableitung
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
    -- Das Alleinstellungsmerkmal: naechster ANHAENGERTAUGLICHER Ladepunkt
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
left join enrich.campsite_charging ecc on ecc.campsite_key = cs.external_key;

create unique index idx_cssearch_id on core.campsite_search (id);
create index idx_cssearch_amen on core.campsite_search using gin (amenities);
create index idx_cssearch_geo  on core.campsite_search (lat, lon);
