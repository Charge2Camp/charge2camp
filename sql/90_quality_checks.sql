-- Auftrag F -- Datenqualitaet (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt 11).
-- Jede Abfrage liefert Zeilen = Problem, leer = in Ordnung (Ausnahmen:
-- #1 Abdeckung, #9 Fuellgrad, #10 Recherche-Fortschritt sind Uebersichten,
-- keine Problemlisten -- siehe jeweilige Beschreibung im Auftragsdokument).
--
-- Zum Ausfuehren gegen die lokale Supabase-Instanz:
--   psql postgresql://postgres:postgres@localhost:54322/postgres -f sql/90_quality_checks.sql
--
-- Dieselben zehn Abfragen stehen auch als Postgres-Funktion
-- core.run_quality_checks() zur Verfuegung (siehe
-- supabase/migrations/20260917000000_quality_checks.sql), die
-- GET /api/admin/quality-report ueber PostgREST aufruft -- dort in EINER
-- Antwort gebuendelt statt als zehn Einzelabfragen. Bei Aenderungen an
-- diesen Abfragen die Funktion in der Migration entsprechend nachziehen.

-- ============================================================
-- 1. Abdeckung je Land: Ladepunkte nach Anhaengertauglichkeits-Verdict,
--    Abdeckungsgrad = Anteil mit bekanntem Verdict (nicht 'unknown').
-- ============================================================
select
    cp.country_code,
    count(*) as total,
    count(*) filter (where ts.verdict = 'yes')     as verdict_yes,
    count(*) filter (where ts.verdict = 'unhitch') as verdict_unhitch,
    count(*) filter (where ts.verdict = 'no')       as verdict_no,
    count(*) filter (where ts.verdict is null or ts.verdict = 'unknown') as verdict_unknown,
    round(100.0 * count(*) filter (where ts.verdict is not null and ts.verdict <> 'unknown')
          / nullif(count(*), 0), 1) as coverage_percent
from core.charge_point cp
left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
group by cp.country_code
order by cp.country_code;

-- ============================================================
-- 2. Koordinaten-Plausibilitaet: Nullinsel (0/0) oder Punkte ausserhalb
--    lat 34-72 / lon -25-45 bei bekanntem europaeischem Laendercode.
-- ============================================================
select 'charge_point' as entity_type, external_key, country_code,
       st_y(geom::geometry) as lat, st_x(geom::geometry) as lon
from core.charge_point
where (st_y(geom::geometry) = 0 and st_x(geom::geometry) = 0)
   or (country_code is not null
       and (st_y(geom::geometry) not between 34 and 72
            or st_x(geom::geometry) not between -25 and 45))
union all
select 'campsite', external_key, country_code,
       st_y(geom::geometry), st_x(geom::geometry)
from core.campsite
where (st_y(geom::geometry) = 0 and st_x(geom::geometry) = 0)
   or (country_code is not null
       and (st_y(geom::geometry) not between 34 and 72
            or st_x(geom::geometry) not between -25 and 45));

-- ============================================================
-- 3. Dubletten Ladepunkte: Paare < 25 m Abstand, gleicher Betreiber.
--    Vor dem Zusammenlegen manuell pruefen -- an Raststaetten stehen
--    echte Saeulen tatsaechlich dicht beieinander.
-- ============================================================
select a.external_key as key_a, b.external_key as key_b, a.operator,
       round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m
from core.charge_point a
join core.charge_point b
  on a.external_key < b.external_key
 and a.operator is not distinct from b.operator
 and st_dwithin(a.geom, b.geom, 25);

-- ============================================================
-- 4. Dubletten Campingplaetze: Paare < 300 m mit similarity(name) > 0.4.
-- ============================================================
select a.external_key as key_a, b.external_key as key_b, a.name,
       round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m,
       round(similarity(a.name, b.name)::numeric, 2) as name_similarity
from core.campsite a
join core.campsite b
  on a.external_key < b.external_key
 and st_dwithin(a.geom, b.geom, 300)
 and similarity(a.name, b.name) > 0.4;

-- ============================================================
-- 5. Verwaiste Anreicherung: enrich.*-Zeilen, deren external_key nicht
--    mehr in core.* existiert. NICHT automatisch loeschen -- melden.
--    Meist ein Quellenfehler, selten ein tatsaechlich abgebauter Ladepunkt.
-- ============================================================
select 'trailer_suitability' as source_table, charge_point_key as external_key
from enrich.trailer_suitability ts
where not exists (select 1 from core.charge_point cp where cp.external_key = ts.charge_point_key)
union all
select 'campsite_charging', campsite_key
from enrich.campsite_charging ecc
where not exists (select 1 from core.campsite cs where cs.external_key = ecc.campsite_key)
union all
select 'research_task', campsite_key
from enrich.research_task rt
where not exists (select 1 from core.campsite cs where cs.external_key = rt.campsite_key);

-- ============================================================
-- 6. Veraltete Datensaetze: last_seen_at < now() - 14 Tage.
-- ============================================================
select 'charge_point' as entity_type, external_key, last_seen_at
from core.charge_point where last_seen_at < now() - interval '14 days'
union all
select 'campsite', external_key, last_seen_at
from core.campsite where last_seen_at < now() - interval '14 days';

-- ============================================================
-- 7. Widersprueche: dispute_count >= 2 UND >= confirm_count.
-- ============================================================
select charge_point_key, verdict, confirm_count, dispute_count
from enrich.trailer_suitability
where dispute_count >= 2 and dispute_count >= confirm_count;

-- ============================================================
-- 8. Verknuepfungs-Sanity: walk_distance_m < air_distance_m - 20
--    (physikalisch unmoeglich) oder Umwegfaktor > 4 (Barriere/Fehlortung).
-- ============================================================
select campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m,
       round((walk_distance_m::numeric / nullif(air_distance_m, 0)), 2) as detour_factor
from core.campsite_charge_link
where walk_distance_m is not null
  and (walk_distance_m < air_distance_m - 20
       or walk_distance_m::numeric / nullif(air_distance_m, 0) > 4);

-- ============================================================
-- 9. Fuellgrad je Merkmal: Anteil gepflegter Werte pro amenity.key.
--    Merkmale unter 30% in der App als Filter ausblenden statt falsche
--    Ergebnisse zu liefern.
-- ============================================================
select a.key as amenity_key,
       count(ca.campsite_id) as filled_count,
       (select count(*) from core.campsite) as total_campsites,
       round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) as fill_percent
from core.amenity a
left join core.campsite_amenity ca on ca.amenity_key = a.key and ca.value_bool is true
group by a.key
having round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) < 30
order by fill_percent asc nulls first;

-- ============================================================
-- 10. Recherche-Fortschritt: offene vs. erledigte research_task-Eintraege
--     je Land.
-- ============================================================
select cs.country_code,
       count(*) filter (where rt.status = 'done') as done,
       count(*) filter (where rt.status <> 'done') as open,
       count(*) as total
from enrich.research_task rt
join core.campsite cs on cs.external_key = rt.campsite_key
group by cs.country_code
order by cs.country_code;
