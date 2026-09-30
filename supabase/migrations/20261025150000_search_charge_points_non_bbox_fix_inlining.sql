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
-- schwere Regression). Die Filter hier haben keine vergleichbar extreme
-- Selektivitaets-Spreizung (q/operator/min_power/connector sind alle ueber
-- passende Indizes gut planbar), zusaetzlich ist eine SQL-Funktion fuer den
-- Planner leichter inlinebar als PL/pgSQL, was das Risiko eines schlechten
-- generic plan weiter reduziert.
-- Diese Migration wurde bereits einmal mit einer 5-Parameter-Signatur
-- (inkl. p_limit) gepusht, dann aber noch am selben Tag auf 4 Parameter
-- (ohne p_limit) korrigiert (siehe Kommentar unten) -- CREATE OR REPLACE
-- ersetzt eine Funktion nur bei IDENTISCHER Parameterliste, sonst entsteht
-- ein zusaetzlicher Overload statt eines Ersatzes (bekannte Falle, siehe
-- 20261012000000 und aehnliche Faelle) -- deshalb hier explizit die alte
-- Signatur droppen.
drop function if exists core.search_charge_points(text, text[], numeric, text[], integer);

-- Bewusst OHNE "order by ... limit ..." im Funktionskoerper: PostgreSQL
-- inlined eine SQL-Sprachfunktion nur dann in die aufrufende Abfrage, wenn
-- ihr Koerper ein EINFACHES SELECT ohne LIMIT/OFFSET ist (siehe
-- src/backend/optimizer/util/clauses.c, inline_set_returning_function) --
-- mit LIMIT im Koerper fuehrt Postgres die Funktion stattdessen als
-- undurchsichtigen "Function Scan" separat aus, OHNE die restriktiven
-- Bedingungen (hier: das EXISTS auf core.connector) beim Planen des inneren
-- SELECT beruecksichtigen zu koennen. Live gemessen: MIT LIMIT im
-- Funktionskoerper 8,3s fuer den Connector-Kategorie-Filter, exakt dieselbe
-- Abfrage OHNE Funktionswrapper (reines SQL) dagegen 310ms. order/limit
-- kommen deshalb ueber den PostgREST-Aufruf von aussen (siehe
-- charging-stations.ts: .order("name").limit(limit) auf das RPC-Ergebnis) --
-- das erlaubt dem Planner, die Funktion zu inlinen und denselben guten Plan
-- wie die reine SQL-Variante zu waehlen.
create or replace function core.search_charge_points(
    p_q text default null,
    p_operators text[] default null,
    p_min_power_kw numeric default null,
    p_connector_standards text[] default null
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
$$;

comment on function core.search_charge_points(text, text[], numeric, text[]) is
  'Server-Erstansicht der Ladepunkte-Seite ohne bekannten Kartenausschnitt (fetchChargingStations, nicht-bbox-Pfad, src/lib/charging-stations.ts) -- ersetzt den vorherigen ad-hoc PostgREST-Query-Builder (ilike/gte/in auf core.charge_point_geo). p_connector_standards filtert ueber ein EXISTS auf core.connector (idx_conn_std), da PostgREST ueber core.charge_point_geo (eine VIEW) keine Embedded-Filter-Beziehung zu core.connector herstellen kann. Bewusst OHNE order/limit im Koerper (siehe Migrationskommentar) -- der Aufrufer wendet beides ueber den PostgREST-Query-Builder auf das RPC-Ergebnis an, das ist fuer die Inlining-Faehigkeit der Funktion erforderlich. security invoker (nicht definer, anders als core.charge_points_in_bbox) -- reine Lesefunktion ohne Schreibzugriff, kein erhoehter Rechtebedarf. Rueckgabeform identisch zu core.charge_point_geo.';

-- Nur service_role: fetchChargingStations() ruft diese Funktion ausschliesslich
-- ueber createAdminClient() (Service-Role-Key) auf, nie ueber eine normale
-- RLS-gebundene Nutzer-Session -- kein Bedarf, den Aufrufkreis weiter zu
-- oeffnen als tatsaechlich genutzt.
grant execute on function core.search_charge_points(text, text[], numeric, text[]) to service_role;
