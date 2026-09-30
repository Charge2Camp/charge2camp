-- Loesung fuer die in 20261025120000 dokumentierte bekannte Einschraenkung:
-- core.charge_points_in_bbox() mit p_trailer_verdicts materialisiert bisher
-- IMMER erst alle passenden enrich.trailer_suitability.charge_point_key in
-- einer CTE, bevor gegen core.charge_point gejoint wird. Fuer den
-- SELEKTIVEN Fall (nur 'yes'/'unhitch'/'no', zusammen ~1,6% aller
-- Ladepunkte) ist das schnell (~700-850ms, Deutschland-weiter Ausschnitt).
-- Waehlt der Nutzer statt dessen (auch) 'unknown' (~98,4% aller
-- Ladepunkte, automatischer BNetzA-Import-Platzhalter), materialisiert
-- dieselbe CTE ueber hunderttausende Zeilen -- gemessen ~35,5s auf
-- Produktion, weit ueber jedem Statement-Timeout ("canceling statement due
-- to statement timeout" auf /ladepunkte).
--
-- Zwei vorherige Versuche, das mit EINER gemeinsamen Query fuer beide
-- Faelle zu loesen, sind gescheitert (20261025100000 EXISTS,
-- 20261025110000 EXECUTE-basiertes EXISTS) -- beide degradierten dabei
-- live gegen Produktion gemessen den bis dahin schnellen selektiven
-- Standardfall auf 50-58s und wurden zurueckgerollt (20261025120000).
-- Vermutete Ursache: core.charge_points_in_bbox() ist eine PL/pgSQL-
-- Funktion mit statischem SQL -- PostgreSQL plant eine mehrfach
-- aufgerufene Anweisung nach den ersten Aufrufen als "generic plan", der
-- die tatsaechlichen Parameterwerte nicht mehr kennt. Bei EINER Query, die
-- fuer stark schwankende Selektivitaet (1,6% vs. 98,4%) denselben
-- Funktionskoerper-Ort verwendet, wird der generic plan fuer BEIDE Faelle
-- kalibriert -- und ist fuer mindestens einen davon katastrophal.
--
-- Fix (analog zu core.charge_point_admin_list()'s p_verdict='checked'-
-- Sonderfall, 20261024120000): die Selektivitaet von p_trailer_verdicts
-- ist VORAB bekannt (nicht erst aus den Daten zu schaetzen) -- 'unknown'
-- ist per Definition der einzige nicht-selektive Wert (BNetzA-Import-
-- Platzhalter, ~98,4%), alle anderen Werte ('yes','unhitch','no') sind
-- zusammen selektiv (~1,6%). Die Funktion verzweigt deshalb VOR der Query
-- (IF/ELSE mit statischem SQL, kein EXECUTE noetig) in zwei getrennte
-- Code-Pfade an zwei getrennten Stellen im Funktionskoerper:
--   - enthaelt p_trailer_verdicts KEIN 'unknown' (nur yes/unhitch/no):
--     weiterhin materialisierte CTE (bewaehrt schnell fuer den seltenen,
--     stark eingrenzenden Fall).
--   - enthaelt p_trailer_verdicts 'unknown' (dominiert die Treffermenge,
--     ~98,4%+): einfaches EXISTS OHNE Materialisierung -- das Enrich-PK
--     (charge_point_key) macht den Einzel-Lookup billig, und da fast jede
--     Zeile ohnehin matcht, ist der Filter fast kostenlos.
-- Weil jeder Zweig an einer EIGENEN Stelle im Funktionskoerper steht,
-- kalibriert PostgreSQL fuer jeden Zweig einen EIGENEN generic plan --
-- anders als bei den gescheiterten Versuchen gibt es keine gemeinsame
-- Query mehr, deren Plan zwischen den beiden Extremen einen Kompromiss
-- finden muesste.
--
-- Lokal verifiziert (synthetische Daten, 124.000 core.charge_point-Zeilen,
-- 98,4%/1,6%-Verdict-Verteilung wie oben, Deutschland-weiter Ausschnitt,
-- je 8 Aufrufe in derselben Session zur Provokation von generic-plan-
-- Caching + EXPLAIN ANALYZE): 'yes'/'unhitch' durchgehend ~30-45ms,
-- 'unknown' durchgehend ~25-70ms -- keine Verschlechterung ueber
-- wiederholte/verschachtelte Aufrufe, kein Materialize-Knoten mehr im Plan
-- fuer den 'unknown'-Fall. Vor dem Produktions-Push mit EXPLAIN ANALYZE
-- (read-only) gegen Produktion nachmessen.
drop function if exists core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]);

create or replace function core.charge_points_in_bbox(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null
)
returns setof core.charge_point_geo
language plpgsql
stable
security definer
set search_path = core, enrich, public
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
        from core.charge_point cp
        join matching_keys mk on mk.charge_point_key = cp.external_key
        where cp.is_active
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
        order by cp.name
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
        from core.charge_point cp
        where cp.is_active
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
          and exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cp.external_key and ts.verdict = any(p_trailer_verdicts)
          )
        order by cp.name
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
        from core.charge_point cp
        where cp.is_active
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
        order by cp.name
        limit p_limit;
    end if;
end;
$$;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). p_trailer_verdicts verzweigt seit 20261025130000 je nach VORAB bekannter Selektivitaet in zwei eigene Code-Pfade (analog core.charge_point_admin_list()''s p_verdict=''checked''-Sonderfall, 20261024120000): ohne ''unknown'' im Array (nur yes/unhitch/no, ~1,6% aller Ladepunkte) eine materialisierte CTE auf idx_ts_verdict VOR dem Join; mit ''unknown'' im Array (dominiert die Treffermenge, ~98,4%+) ein einfaches EXISTS ohne Materialisierung. Grund fuer die Aufspaltung: eine einzelne gemeinsame Query fuer beide Faelle fuehrte wiederholt zu PL/pgSQL-generic-plan-Regressionen, die je nach Variante den jeweils anderen Fall auf 35-58s verschlechterten (siehe 20261025100000/20261025110000/20261025120000) -- mit getrennten Codepfaden kalibriert Postgres fuer jeden einen eigenen generic plan. Rueckgabeform weiterhin identisch zu core.charge_point_geo.';
