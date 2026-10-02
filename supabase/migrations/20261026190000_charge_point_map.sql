-- Schmale Karten-Tabelle core.charge_point_map: haelt die Daten des Kartenausschnitts
-- im Arbeitsspeicher, statt sie aus der breiten Haupttabelle zu lesen.
--
-- Ausgangslage (Produktion, gemessen): core.charge_point hat 431 MB Heap + 187 MB Indizes
-- (618 MB) bei shared_buffers 224 MB / effective_cache_size 384 MB -- sie passt nicht in den
-- Cache, jeder Zugriff auf verstreute Ladepunkte (id-Stichprobe!) liest von der Platte.
-- Ursache: Durchschnittszeile 1.364 Byte, davon 1.111 Byte field_provenance (jsonb,
-- Herkunftsnachweis je Feld, von der Karte nie gelesen); die Karte braucht ~260 Byte je
-- Ladepunkt. Ein Auslagern per STORAGE EXTERNAL/toast_tuple_target wirkt NICHT (lokal
-- geprueft: Zeilen unter 2 KB werden nie ausgelagert, Heap blieb bei 187-200 MB).
-- Folge: Erstaufrufe nach Ruhephasen 6-9 s (kalt) statt 0,1-0,5 s (warm).
--
-- Loesung: eine MATERIALIZED VIEW mit nur den ~22 Spalten von core.charge_point_geo (aktive
-- Ladepunkte, +lat/lon) -- grob 40 MB Heap + ~60 MB Indizes, passt zusammen mit dem
-- Connector-Index (20 MB) und dem Trailer-Teilindex in die 224 MB shared_buffers. Gleiches
-- Muster wie core.campsite_search: security-definer-Refresh-Funktion + pg_cron.
--
-- ACHTUNG, bewusste Abwaegung: Die Kartendaten hinken Aenderungen an core.charge_point
-- (Import, Admin-Bearbeitung, Deaktivierung) um bis zu 15 Minuten hinterher (Refresh-
-- Intervall). Nur der Kartenausschnitt (core.charge_points_in_bbox/_enriched) liest die
-- View; Erstansicht, Suche, Detailseiten und Admin lesen weiter die Haupttabelle.
-- REFRESH ... CONCURRENTLY liest die Haupttabelle einmal komplett (grosser Sequential Scan
-- nutzt nur einen kleinen Ring-Puffer und raeumt shared_buffers nicht leer).
--
-- Indizes: unique (id) [fuer CONCURRENTLY + id-Stichprobe], GiST geom, id fuer Schnelllader
-- (Teilindex >= 150 kW), (operator, id) fuer Betreiberfilter mit Stichprobe, Trigram auf
-- name (Namenssuche), unique (external_key) [Join zu enrich.trailer_suitability], Leistung.
--
-- core.charge_points_in_bbox: Signatur UNVERAENDERT (10 Parameter), nur die drei FROM-
-- Stellen lesen jetzt core.charge_point_map -- create or replace, kein DROP. Alles andere
-- (SET-Klauseln, Verdict-Zweige, id-Stichprobe, Filter) unveraendert.
-- Lokal getestet; NICHT in Produktion angewendet/gemessen.

create materialized view core.charge_point_map as
select
    cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
    cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
    cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
    cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
    cp.is_active,
    st_y(cp.geom::geometry) as lat,
    st_x(cp.geom::geometry) as lon
from core.charge_point cp
where cp.is_active;

create unique index idx_cpm_id on core.charge_point_map (id);
create unique index idx_cpm_external_key on core.charge_point_map (external_key);
create index idx_cpm_geom on core.charge_point_map using gist (geom);
create index idx_cpm_fast_id on core.charge_point_map (id) where max_power_kw >= 150;
create index idx_cpm_operator_id on core.charge_point_map (operator, id);
create index idx_cpm_name_trgm on core.charge_point_map using gin (name gin_trgm_ops);
create index idx_cpm_power on core.charge_point_map (max_power_kw);

analyze core.charge_point_map;

create or replace function core.refresh_charge_point_map()
returns void
language sql
security definer
set search_path = core, public
as $$
  refresh materialized view concurrently core.charge_point_map;
$$;

grant execute on function core.refresh_charge_point_map() to service_role;

comment on materialized view core.charge_point_map is
  'Schmale Kopie der aktiven Ladepunkte (Spalten von core.charge_point_geo) NUR fuer die Karten-Viewport-Abfrage core.charge_points_in_bbox; haelt die Daten im Cache statt der breiten Haupttabelle (field_provenance macht 81 % einer Zeile aus). Aktualisierung per pg_cron alle 15 Minuten (core.refresh_charge_point_map) -- Karte hinkt Aenderungen an core.charge_point um bis zu 15 Minuten hinterher. Siehe Migration 20261026190000.';

-- pg_cron-Job (Muster wie refresh-all-quality-data, 20261019030000), alle 15 Minuten
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-charge-point-map';
select cron.schedule(
    'refresh-charge-point-map',
    '*/15 * * * *',
    $$select core.refresh_charge_point_map()$$
);

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
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
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
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
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
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
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
