-- Performance-/Korrektheits-Audit 2026-09-30 (Fortsetzung von 20261025130000):
-- der NICHT-bbox-Pfad von fetchChargingStations() (src/lib/charging-stations.ts,
-- Server-Erstansicht der Ladepunkte-Seite ohne bekannten Kartenausschnitt)
-- baute seine Abfrage bisher direkt ueber den PostgREST-Query-Builder
-- (ilike/gte/in auf core.charge_point_geo) -- q/operator/min_power_kw
-- liessen sich so zwar in SQL filtern, connectorCategories dagegen NICHT:
-- core.connector haengt ueber charge_point_id an core.charge_point, PostgREST
-- kann ueber eine VIEW (charge_point_geo) keine Embedded-Filter-Beziehung
-- dorthin herstellen. connectorCategories wurde deshalb bisher ausschliesslich
-- in JS NACH der vollen Connector-/Trailer-Anreicherung gefiltert -- exakt
-- derselbe Fehler wie operator zuvor (siehe Commit "Betreiber-Filter im
-- nicht-bbox-Pfad in SQL statt erst in JS filtern"): ohne q/trailerVerdict-
-- Selektivitaet laedt hasActiveFilters/stationLimit (ladepunkte/page.tsx)
-- dabei die ersten 5000 Ladepunkte UNGEFILTERT nach Steckertyp und reichert
-- sie komplett an, bevor der Filter ueberhaupt greift.
--
-- Fix: eine dedizierte Funktion, die ALLE nicht-bbox-Filter (q, operators,
-- min_power_kw, connector_standards) direkt in SQL kombiniert -- fuer
-- connector_standards ueber ein EXISTS auf core.connector (idx_conn_std),
-- statt einer riesigen ID-Liste ueber die REST-API (bei einer verbreiteten
-- Kategorie wie "Type 2" potenziell zehntausende IDs -- weit jenseits
-- sinnvoller URL-/Query-Groessen). `language sql` statt `plpgsql`: bewusst
-- KEIN PL/pgSQL-Funktionskoerper mit statischem SQL (siehe Migrations-
-- kommentare 20261025100000/110000/120000 -- dort verursachte PL/pgSQLs
-- generic-plan-Caching bei stark schwankender Parameter-Selektivitaet eine
-- schwere Regression).
--
-- BEKANNTE EINSCHRAENKUNG dieser urspruenglichen Fassung (noch am selben Tag
-- entdeckt, siehe 20261025150000): das "order by ... limit p_limit" HIER im
-- Funktionskoerper verhindert, dass Postgres diese (an sich inlinebare)
-- SQL-Funktion in die aufrufende Abfrage inlined -- der Connector-Kategorie-
-- Filter brauchte dadurch gemessen 8,3s statt 310ms fuer dieselbe Abfrage
-- ohne Funktionswrapper. 20261025150000 korrigiert das, indem order/limit
-- stattdessen ueber den PostgREST-Aufruf von aussen angewendet werden.
create or replace function core.search_charge_points(
    p_q text default null,
    p_operators text[] default null,
    p_min_power_kw numeric default null,
    p_connector_standards text[] default null,
    p_limit integer default 300
)
returns setof core.charge_point_geo
language sql
stable
security invoker
set search_path = core, public
as $$
    select cpg.*
    from core.charge_point_geo cpg
    where (p_q is null or cpg.name ilike '%' || p_q || '%')
      and (p_operators is null or cpg.operator = any(p_operators))
      and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
      and (
        p_connector_standards is null or exists (
          select 1 from core.connector c
          where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
        )
      )
    order by cpg.name
    limit p_limit;
$$;

comment on function core.search_charge_points(text, text[], numeric, text[], integer) is
  'VERALTET, siehe 20261025150000 fuer die aktuelle (4-Parameter, ohne p_limit) Fassung -- diese 5-Parameter-Version bleibt nur als historischer Migrationsschritt erhalten. Server-Erstansicht der Ladepunkte-Seite ohne bekannten Kartenausschnitt (fetchChargingStations, nicht-bbox-Pfad, src/lib/charging-stations.ts).';

grant execute on function core.search_charge_points(text, text[], numeric, text[], integer) to service_role;
