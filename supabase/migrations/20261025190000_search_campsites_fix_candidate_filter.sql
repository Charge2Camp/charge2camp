-- Korrigiert eine weitere Ineffizienz aus 20261025170000/180000, noch am
-- selben Tag live gegen Produktion gefunden: auch der CTE-basierte Join
-- zwischen core.campsite (geofiltert) und der VIEW core.campsite_search
-- ueber "= id" blieb ein Nested Loop mit kompletter Neumaterialisierung der
-- View pro Kandidat (EXPLAIN: "Seq Scan on campsite_search ... loops=916"),
-- weil ein JOIN auf eine View ohne eigenen Index Postgres nicht zu einem
-- indexgestuetzten Nachschlagen zwingt. Gemessen weiterhin ~400-800ms statt
-- der erwarteten Verbesserung.
--
-- Fix: statt eines JOINs liefert eine Subquery-Array-Mitgliedschaftspruefung
-- ("csr.id = any(array(select id from core.campsite where ...))") dieselbe
-- Eingrenzung -- dafuer nutzt Postgres einen Bitmap Index Scan auf
-- idx_cssearch_id (campsite_search hat dafuer bereits einen eigenen Index),
-- der die teuren View-Subqueries NUR noch fuer die tatsaechlichen
-- Kandidaten auswertet, nicht mehr pro Kandidat die gesamte Tabelle.
-- Live gemessen: 805ms (20261025170000) / ~410ms (20261025180000) -> 81ms.
-- Die Distanz fuer die Sortierung kommt jetzt direkt aus csr.lat/csr.lon
-- (von der View ohnehin schon berechnet) statt ueber einen Join auf
-- core.campsite.geom -- kein Praezisionsverlust, dieselbe ST_Distance-
-- Berechnung, nur ohne den teuren Join.
create or replace function core.search_campsites(
    p_q text default null,
    p_country text default null,
    p_amenities text[] default null,
    p_charging text default null,
    p_ev_score_min integer default null,
    p_rating_min numeric default null,
    p_near_lat double precision default null,
    p_near_lon double precision default null,
    p_radius_km double precision default null,
    p_limit integer default 5000
)
returns setof core.campsite_search
language sql
stable
as $$
    select csr.*
    from core.campsite_search csr
    where (p_q is null or csr.name ilike '%' || p_q || '%')
      and (p_country is null or csr.country_code = p_country)
      and (p_amenities is null or csr.amenities @> p_amenities)
      and (
        p_charging is null
        or (p_charging = 'on_site' and csr.charging_on_site)
        or (p_charging = 'ac_walk' and csr.walkable_ac_m is not null)
        or (p_charging = 'dc_walk' and csr.walkable_dc_m is not null)
      )
      and (p_ev_score_min is null or csr.ev_score >= p_ev_score_min)
      and (p_rating_min is null or csr.rating_avg >= p_rating_min)
      and (
        p_near_lat is null or p_near_lon is null or p_radius_km is null
        or csr.id = any(array(
             select cs.id from core.campsite cs
             where cs.is_active
               and ST_DWithin(cs.geom, ST_MakePoint(p_near_lon, p_near_lat)::geography, p_radius_km * 1000)
           ))
      )
    order by
      case when p_near_lat is not null and p_near_lon is not null and p_radius_km is not null
        then ST_Distance(ST_MakePoint(csr.lon, csr.lat)::geography, ST_MakePoint(p_near_lon, p_near_lat)::geography)
      end asc nulls last,
      csr.name asc
    limit p_limit;
$$;

comment on function core.search_campsites(text, text, text[], text, integer, numeric, double precision, double precision, double precision, integer) is
  'Server-Erstansicht/Suche der Campingplaetze-Seite (fetchCampsites, src/lib/campsites.ts). Umkreis-Eingrenzung ueber eine Subquery-Array-Mitgliedschaftspruefung (csr.id = any(array(...))) statt eines Joins -- nutzt idx_cssearch_id fuer einen Bitmap Index Scan, wertet die teuren korrelierten Subqueries der campsite_search-View dadurch nur fuer die tatsaechlichen Kandidaten aus (siehe Migrationskommentar 20261025190000, 805ms -> 81ms gemessen). Distanzsortierung ueber csr.lat/csr.lon (bereits von der View berechnet). Rueckgabeform identisch zu core.campsite_search.';
