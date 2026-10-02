-- Kartenausschnitt als PLANARES Rechteck statt als Geographie-Polygon.
--
-- Problem (lokal und in Produktion mit PostGIS reproduziert): core.charge_points_in_bbox
-- verglich "geom && ST_MakeEnvelope(...)::geography". Ein Geographie-Polygon hat
-- Grosskreis-Kanten und ist ab ~180 Grad Laengenbreite NICHT mehr das Lat/Lon-
-- Rechteck der Karte. Folgen mit den Testdaten (alle Ladepunkte zwischen Laenge 5-15,
-- Breite 44-54, korrekte Antwort immer 49.600):
--   Breite 179,9 / 180 Grad   -> 49.600 (richtig)
--   Breite 200 / 300 Grad     -> 0        (falsch, still leere Karte)
--   Welt (-179,9..179,9)      -> 0        (falsch)
--   Welt (-180..180, -90..90) -> FEHLER "Antipodal (180 degrees long) edge detected"
--   west < -180 / east > 180  -> Werte werden UMGEWICKELT (west -200 => 160): 561
--                                statt 49.600 Ladepunkte, east 200 => 0 Ladepunkte
-- Ein reines Clampen der Werte im Client haette das nicht behoben (schon die korrekt
-- geklemmte Welt wirft den Fehler). Betroffen sind weit herausgezoomte Ansichten
-- (gepolsterte Breite > 180 Grad, d. h. sichtbar > ~120 Grad, Zoom < ~2,5).
--
-- Fix: planarer Vergleich "geom::geometry && ST_MakeEnvelope(west, south, east, north, 4326)"
-- -- exakt die Bedeutung eines Karten-Viewports (Lat/Lon-Rechteck, Punkte), ohne
-- Koordinaten-Umwicklung und ohne Antipoden-Fehler, auch ueber +-180/+-90 hinaus. Dafuer
-- ein GiST-Index auf dem Ausdruck (geom::geometry) von core.charge_point_map; der alte
-- Geographie-GiST-Index idx_cpm_geom wird danach nicht mehr gelesen und entfaellt. Die
-- Funktion liest nur noch diesen Ausdruck. Kleine Abweichung gegenueber vorher: am
-- Nord-/Suedrand eines Ausschnitts entscheidet jetzt der konstante Breitengrad statt
-- eines gewoelbten Grosskreises -- planar ist hier die richtige Semantik.
--
-- Signatur/Parameter/SET-Klauseln unveraendert (create or replace, kein DROP), nur die
-- drei bbox-Praedikate. Lokal getestet; NICHT in Produktion angewendet/gemessen.

create index idx_cpm_geom_planar on core.charge_point_map using gist ((geom::geometry));
analyze core.charge_point_map;

create or replace function core.charge_points_in_bbox(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null,
    p_operators text[] default null,
    p_connector_standards text[] default null
)
returns setof core.charge_point_geo
language plpgsql
stable
security definer
set search_path = core, enrich, public
set plan_cache_mode = force_custom_plan
as $$
begin
    if p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0
       and not ('unknown' = any(p_trailer_verdicts)) then
        -- Selektiver Fall (nur yes/unhitch/no, ~1,6% aller Ladepunkte):
        -- materialisierte CTE grenzt zuerst auf die kleine Treffermenge
        -- ueber idx_ts_verdict ein, bevor gegen core.charge_point gejoint
        -- wird.
        return query
        with matching_keys as materialized (
            select charge_point_key
            from enrich.trailer_suitability
            where verdict = any(p_trailer_verdicts)
        )
        select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
        from core.charge_point_map cp
        join matching_keys mk on mk.charge_point_key = cp.external_key
        where cp.is_active
          and cp.geom::geometry && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
        order by cp.id
        limit p_limit;
    elsif p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0 then
        -- Nicht-selektiver Fall (p_trailer_verdicts enthaelt 'unknown',
        -- dominiert die Treffermenge mit ~98,4%+): keine Materialisierung,
        -- einfaches EXISTS auf dem PK (charge_point_key) -- da fast jede
        -- Zeile matcht, ist der Filter praktisch kostenlos und braucht
        -- keine Vorab-Eingrenzung.
        return query
        select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
        from core.charge_point_map cp
        where cp.is_active
          and cp.geom::geometry && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
          -- 'unknown' = noch nicht bewertet: ausgeschlossen werden nur Ladepunkte mit einer
          -- ECHTEN Bewertung (keine Platzhalter-Zeile), deren Verdict nicht in der Liste
          -- steht. Ladepunkte ohne echte Bewertung (inkl. solcher ganz ohne
          -- trailer_suitability-Zeile) zaehlen als 'unknown'. Das Praedikat der echten
          -- Bewertung muss WOERTLICH zu idx_ts_meaningful passen (Teilindex).
          and not exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cp.external_key
              and not (ts.verdict = 'unknown' and ts.origin = 'auto' and ts.notes is null and ts.drive_through is null)
              and not (ts.verdict = any(p_trailer_verdicts))
          )
        order by cp.id
        limit p_limit;
    else
        return query
        select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
        from core.charge_point_map cp
        where cp.is_active
          and cp.geom::geometry && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
        order by cp.id
        limit p_limit;
    end if;
end;
$$;

drop index core.idx_cpm_geom;
