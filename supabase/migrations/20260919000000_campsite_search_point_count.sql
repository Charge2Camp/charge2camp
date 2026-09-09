-- Der EV-Camping-Score (src/lib/scoring/ev-camping-score.ts) berechnet
-- "Anzahl Ladepunkte auf dem Platz" bisher ausschliesslich aus
-- core.campsite_charge_link (relation='on_site', OSM-abgeleitete Verknuepfung
-- geografisch naher Ladepunkte). Ist diese Verknuepfung unvollstaendig
-- (z. B. Ladepunkte ohne eigenen OSM-Node, oder faelschlich nicht als
-- "on_site" erkannt), kann ein Admin das bisher NIRGENDS korrigieren --
-- enrich.campsite_charging.point_count existiert zwar im Schema, wird aber
-- weder von core.campsite_search noch vom Admin-Backend genutzt.
--
-- core.campsite_search ist eine MATERIALIZED VIEW, keine Tabelle (siehe
-- Migration 20260909020000) -- Aenderungen an der Definition erfordern
-- DROP + CREATE, kein CREATE OR REPLACE.
--
-- Nebenbei mitgefixt: die Neudefinition in Migration 20260913000200 (data
-- layer schema refactor) hatte den "where cs.is_active"-Filter aus der
-- urspruenglichen Fassung (20260909020000) verloren -- deaktivierte
-- Campingplaetze verschwanden dadurch zwar von ihrer eigenen Detailseite
-- (core.campsite wird dort direkt mit is_active=true abgefragt), tauchten
-- aber weiterhin in /campingplaetze (Liste/Suche, liest campsite_search)
-- auf. Filter unten wiederhergestellt.
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
    -- Laden auf dem Platz: eigene Recherche hat Vorrang vor OSM-Ableitung
    coalesce(ecc.has_charging,
             exists (select 1 from core.campsite_charge_link l
                     where l.campsite_id = cs.id and l.relation = 'on_site')
    ) as charging_on_site,
    ecc.max_power_kw   as on_site_power_kw,
    -- Manuelle Admin-Korrektur (enrich.campsite_charging.point_count) hat
    -- Vorrang, sonst faellt die App auf die OSM-abgeleitete Zaehlung
    -- (core.campsite_charge_link, relation='on_site') zurueck.
    ecc.point_count    as on_site_point_count,
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
left join enrich.campsite_charging ecc on ecc.campsite_key = cs.external_key
where cs.is_active;

create unique index idx_cssearch_id on core.campsite_search (id);
create index idx_cssearch_amen on core.campsite_search using gin (amenities);
create index idx_cssearch_geo  on core.campsite_search (lat, lon);

grant select on core.campsite_search to anon, authenticated;

select core.refresh_campsite_search();
