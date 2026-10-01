-- Korrigiert eine Ineffizienz aus 20261025170000, noch am selben Tag live
-- gegen Produktion gefunden: der direkte Join zwischen core.campsite cp
-- (geofiltert, z. B. 916 Treffer bei 200km um Muenchen) und der VIEW
-- core.campsite_search csr ueber "csr.id = cp.id" liess Postgres die View
-- NICHT indexgestuetzt nach id nachschlagen, sondern sie fuer JEDEN der 916
-- geofilterten Treffer komplett per Sequential Scan neu materialisieren
-- (EXPLAIN: "Seq Scan on campsite_search csr ... loops=916" -- bei 3.706
-- Campingplaetzen insgesamt macht das ~2,6 Mio. Zeilenauswertungen der
-- (teuren, mehrere korrelierte Subqueries pro Zeile enthaltenden)
-- campsite_search-Definition). Gemessen 805ms bei aktuell noch kleiner
-- Datenmenge -- bei EU-weitem Rollout (zehntausende Campingplaetze) waere
-- dieses Muster (Kosten wachsen mit Kandidaten x Gesamtmenge, nicht nur mit
-- der Kandidatenmenge) der naechste Statement-Timeout-Kandidat gewesen.
--
-- Fix: eine CTE filtert ZUERST ausschliesslich auf core.campsite-
-- Basisspalten (is_active, name, country_code, geom -- alle indexgestuetzt:
-- idx_cs_name_trgm, idx_cs_country, idx_cs_geom) und liefert eine kleine
-- Kandidaten-ID-Menge + vorab berechnete Distanz. Erst DANACH wird gegen
-- core.campsite_search gejoint -- ueber die id (campsite_pkey) kann Postgres
-- das jetzt als indexgestuetzten Nested Loop planen, die teuren
-- View-Subqueries laufen dadurch nur noch fuer die bereits eingegrenzten
-- Kandidaten, nicht mehr fuer die gesamte Tabelle pro Kandidat.
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
    with candidates as (
        select
            cs.id,
            case when p_near_lat is not null and p_near_lon is not null and p_radius_km is not null
                then ST_Distance(cs.geom, ST_MakePoint(p_near_lon, p_near_lat)::geography)
            end as distance_m
        from core.campsite cs
        where cs.is_active
          and (p_q is null or cs.name ilike '%' || p_q || '%')
          and (p_country is null or cs.country_code = p_country)
          and (
            p_near_lat is null or p_near_lon is null or p_radius_km is null
            or ST_DWithin(cs.geom, ST_MakePoint(p_near_lon, p_near_lat)::geography, p_radius_km * 1000)
          )
    )
    select csr.*
    from core.campsite_search csr
    join candidates c on c.id = csr.id
    where (p_amenities is null or csr.amenities @> p_amenities)
      and (
        p_charging is null
        or (p_charging = 'on_site' and csr.charging_on_site)
        or (p_charging = 'ac_walk' and csr.walkable_ac_m is not null)
        or (p_charging = 'dc_walk' and csr.walkable_dc_m is not null)
      )
      and (p_ev_score_min is null or csr.ev_score >= p_ev_score_min)
      and (p_rating_min is null or csr.rating_avg >= p_rating_min)
    order by c.distance_m asc nulls last, csr.name asc
    limit p_limit;
$$;

comment on function core.search_campsites(text, text, text[], text, integer, numeric, double precision, double precision, double precision, integer) is
  'Server-Erstansicht/Suche der Campingplaetze-Seite (fetchCampsites, src/lib/campsites.ts). Filtert ueber eine CTE zuerst auf core.campsite-Basisspalten (indexgestuetzt: idx_cs_name_trgm, idx_cs_country, idx_cs_geom/ST_DWithin), joint erst danach auf die VIEW core.campsite_search (id-indexgestuetzt statt vollem Scan pro Kandidat, siehe Migrationskommentar 20261025180000) -- vermeidet, die teuren korrelierten Subqueries der View fuer mehr als die tatsaechlichen Kandidaten auszuwerten. Rueckgabeform identisch zu core.campsite_search.';
