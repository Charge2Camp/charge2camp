-- Root Cause eines wiederholten Produktions-Absturzes auf /ladepunkte
-- gefunden und mit EXPLAIN ANALYZE direkt gegen Produktion verifiziert
-- (Nutzermeldung 2026-09-30, auch ueber Mobilfunknetz reproduzierbar --
-- also kein Heimnetz-/ISP-Problem, wie zunaechst vermutet):
--
-- core.charge_points_in_bbox() (20261024240000) materialisiert bei aktivem
-- p_trailer_verdicts-Filter ALLE passenden enrich.trailer_suitability.
-- charge_point_key in einer CTE, BEVOR gegen core.charge_point gejoint
-- wird -- fuer den SELEKTIVEN Standardfall ('yes'/'unhitch', ~1,6% aller
-- Ladepunkte) ist das sehr schnell. Waehlt der Nutzer stattdessen den
-- Filter "Noch nicht bewertet" (verdict='unknown', ~98% aller Ladepunkte --
-- der automatische BNetzA-Import-Platzhalter), materialisiert dieselbe CTE
-- ueber hunderttausende Zeilen: gemessen 35,5s bei einem Deutschland-weiten
-- Kartenausschnitt (weit ueber jedem Statement-Timeout), gegenueber 18ms
-- bis 300ms fuer denselben Fall OHNE die Materialisierung (siehe unten).
--
-- Fix: die materialisierte CTE entfaellt komplett zugunsten eines simplen
-- EXISTS-Filters -- der Postgres-Planer waehlt dafuer je nach tatsaechlicher
-- Selektivitaet selbststaendig einen guenstigen Plan (Nested-Loop-Index-
-- Scan bei seltenen Werten, Hash-artiger Plan bei haeufigen), ohne dass die
-- Anwendung die Selektivitaet vorab kennen oder zwei Code-Pfade pflegen
-- muss. Gemessen (EXPLAIN ANALYZE, Deutschland-weiter Ausschnitt,
-- p_limit=1500): 'yes'/'unhitch' ~300ms, 'unknown' ~18ms (warmer Cache) --
-- beide Faelle komfortabel unter jedem realistischen Timeout, anders als
-- die bisherige 35,5s-Falle.
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
      and (
        p_trailer_verdicts is null or array_length(p_trailer_verdicts, 1) is null
        or exists (
          select 1 from enrich.trailer_suitability ts
          where ts.charge_point_key = cp.external_key and ts.verdict = any(p_trailer_verdicts)
        )
      )
    order by cp.name
    limit p_limit;
end;
$$;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). p_trailer_verdicts filtert ueber ein einfaches EXISTS auf enrich.trailer_suitability (seit 20261025100000 -- vorher eine materialisierte CTE, die bei wenig selektiven Werten wie verdict=''unknown'' (~98% aller Ladepunkte) auf ueber 35s Laufzeit kam, siehe Migrationskommentar). Rueckgabeform weiterhin identisch zu core.charge_point_geo.';
