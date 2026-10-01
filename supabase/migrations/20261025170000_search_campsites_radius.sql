-- EU-Skalierungs-Audit 2026-10-01 (Fortsetzung des Audits, das heute schon
-- den gleichwertigen Ladepunkte-Bug gefunden/behoben hat): fetchCampsites()
-- (src/lib/campsites.ts) filterte die Umkreissuche bisher per grobzuegigem
-- Lat/Lon-Bounding-Box-Vorfilter in SQL (`.gte/.lte` auf die berechneten
-- lat/lon-Spalten der core.campsite_search-VIEW -- keine echte PostGIS-
-- Abfrage, da die View selbst keine Geometrie-Spalte nach aussen gibt),
-- danach `.order("name").limit(5000)` und ERST DANACH eine praezise
-- Haversine-Distanzfilterung/-Sortierung in JS. Aktuell (3.706 Campingplaetze
-- gesamt) faellt das nicht auf -- bei einem vollstaendig europaweiten
-- Rollout (zehntausende Campingplaetze) kann eine dichte Region bei einem
-- grossen Radius (bis 200km, siehe RADIUS_KM_OPTIONS) durchaus mehr als 5000
-- Treffer INNERHALB der groben Box enthalten: die alphabetische Sortierung
-- VOR dem Limit koennte dann echte, naeher gelegene Treffer stillschweigend
-- abschneiden, noch bevor die praezise Umkreispruefung ueberhaupt laeuft --
-- derselbe Fehlerklasse wie der heute behobene Ladepunkte-Bug (siehe
-- Commits "Betreiber-Filter"/"Connector-Kategorie-Filter im nicht-bbox-Pfad
-- in SQL statt erst in JS filtern").
--
-- Fix: core.campsite (die Basistabelle hinter core.campsite_search) hat
-- bereits eine PostGIS-geography-Spalte MIT GiST-Index (geom, idx_cs_geom) --
-- die View legt das zwar nicht offen (nur abgeleitete lat/lon), aber diese
-- Funktion kann ueber einen Join auf core.campsite trotzdem ST_DWithin
-- nutzen, exakt wie core.charge_points_in_bbox() das fuer Ladepunkte schon
-- tut. Alle anderen Filter (q, country, amenities, charging, ev_score_min,
-- rating_min) wandern ebenfalls direkt in diese Funktion, statt teils in
-- SQL/teils in JS gemischt zu sein.
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
    join core.campsite cp on cp.id = csr.id
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
        or ST_DWithin(cp.geom, ST_MakePoint(p_near_lon, p_near_lat)::geography, p_radius_km * 1000)
      )
    order by
      case when p_near_lat is not null and p_near_lon is not null and p_radius_km is not null
        then ST_Distance(cp.geom, ST_MakePoint(p_near_lon, p_near_lat)::geography)
      end asc nulls last,
      csr.name asc
    limit p_limit;
$$;

comment on function core.search_campsites(text, text, text[], text, integer, numeric, double precision, double precision, double precision, integer) is
  'Server-Erstansicht/Suche der Campingplaetze-Seite (fetchCampsites, src/lib/campsites.ts) -- ersetzt den vorherigen ad-hoc PostgREST-Query-Builder (Lat/Lon-Bounding-Box + nachgelagerte Haversine-Filterung/-Sortierung in JS). Nutzt ST_DWithin/ST_Distance auf core.campsite.geom (idx_cs_geom, GiST) fuer eine praezise, indexgestuetzte Umkreissuche -- die View core.campsite_search selbst legt keine Geometrie offen, deshalb der Join auf core.campsite. Rueckgabeform identisch zu core.campsite_search.';

grant execute on function core.search_campsites(text, text, text[], text, integer, numeric, double precision, double precision, double precision, integer) to service_role;
