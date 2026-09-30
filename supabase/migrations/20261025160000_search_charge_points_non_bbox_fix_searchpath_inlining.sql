-- Fortsetzung von 20261025150000: das Entfernen von "order by ... limit ..."
-- aus dem Funktionskoerper loeste das Inlining-Problem NICHT vollstaendig --
-- live gegen Produktion gemessen weiterhin 34,9s (Connector-Kategorie-
-- Filter) statt der erwarteten ~310ms. Ursache war nicht LIMIT, sondern
-- "set search_path = core, public" auf der Funktion: Postgres inlined eine
-- SQL-Sprachfunktion nur, wenn sie KEIN proconfig (SET-Klauseln wie
-- search_path) traegt (inline_set_returning_function,
-- src/backend/optimizer/util/clauses.c) -- mit gesetztem search_path bleibt
-- sie ein undurchsichtiger "Function Scan", unabhaengig von LIMIT im Koerper.
-- Per Ad-hoc-Test direkt gegen Produktion verifiziert: dieselbe Funktion OHNE
-- "set search_path" inlined korrekt (Index Scan + integriertes EXISTS-
-- SubPlan statt Function Scan), 34,9s -> 1,05s.
--
-- search_path-Pinning ist hier ohnehin nur Verteidigung in der Tiefe, keine
-- funktionale Notwendigkeit: core.charge_point_geo/core.connector sind im
-- Funktionskoerper bereits vollstaendig schemaqualifiziert (anders als z. B.
-- core.charge_points_in_bbox, dessen PL/pgSQL-Koerper unqualifizierte Bezuege
-- verwendet und deshalb weiterhin ein search_path braucht). Sicherheitsrisiko
-- durch das Entfernen hier deshalb keines.
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
  'Server-Erstansicht der Ladepunkte-Seite ohne bekannten Kartenausschnitt (fetchChargingStations, nicht-bbox-Pfad, src/lib/charging-stations.ts) -- ersetzt den vorherigen ad-hoc PostgREST-Query-Builder (ilike/gte/in auf core.charge_point_geo). p_connector_standards filtert ueber ein EXISTS auf core.connector (idx_conn_std), da PostgREST ueber core.charge_point_geo (eine VIEW) keine Embedded-Filter-Beziehung zu core.connector herstellen kann. Bewusst OHNE order/limit UND ohne "set search_path" im Koerper (siehe Migrationskommentare 20261025150000/160000) -- beides zusammen war fuer die Inlining-Faehigkeit der SQL-Funktion erforderlich (8,3s/34,9s -> ~1s), Tabellenverweise sind stattdessen vollstaendig schemaqualifiziert. security invoker (nicht definer, anders als core.charge_points_in_bbox) -- reine Lesefunktion ohne Schreibzugriff, kein erhoehter Rechtebedarf. Rueckgabeform identisch zu core.charge_point_geo.';
