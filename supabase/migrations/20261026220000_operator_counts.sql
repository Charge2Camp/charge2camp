-- Betreiber-Optionen der Ladepunkte-Seite aus einer winzigen vorberechneten Tabelle statt
-- bei jedem Seitenaufruf alle ~124.000 Ladepunkte zu zaehlen.
--
-- Ausgangslage (Produktion, nach 20261026210000, drei Laeufe): core.charge_point_operator_options
-- zaehlt je Aufruf alle aktiven Ladepunkte nach Betreiber (Sequential Scan der schmalen
-- Kopie, ~10.600 verschiedene Betreiber, davon nur wenige hundert mit >= 20 Stationen):
-- 385 ms beim ersten Aufruf, ~90 ms warm -- bei JEDEM Aufruf von /ladepunkte, obwohl sich
-- die Betreiberliste kaum aendert. Es ist der langsamste Teil der Erstansicht.
--
-- Loesung: core.charge_point_operator_counts (Materialized View) enthaelt die Zaehlung je
-- Betreiber (gleiche Filter wie bisher: Betreiber nicht null und nicht in Klammern, nur
-- aktive Ladepunkte -- die Kopie enthaelt nur aktive). Quelle ist core.charge_point_map, nicht
-- die Haupttabelle. Die Funktion liest nur noch diese Tabelle (~10.600 Zeilen) und filtert
-- p_min_stations dort. Signatur, Rueckgabetyp, security definer und der Admin-Check bleiben.
--
-- Aktualisierung: core.refresh_charge_point_map() (vom bestehenden pg_cron-Job alle 15 Minuten)
-- aktualisiert jetzt ZUERST die Kopie und DANACH die Zaehlung -- ein Job, eine Stelle zum
-- Ueberwachen. Die Betreiberliste hinkt damit hoechstens 15 Minuten hinterher, wie die Karte.
-- Scheitert der zweite Refresh, schlaegt der Job fehl (sichtbar in cron.job_run_details); die
-- Kopie ist dann trotzdem aktualisiert.
--
-- Lokal gegen die bisherige Funktion verglichen (Schwellen 1/5/20/100/99999, Reihenfolge):
-- identisch; NICHT in Produktion angewendet/gemessen.

create materialized view core.charge_point_operator_counts as
select cp.operator, count(*)::bigint as station_count
from core.charge_point_map cp
where cp.operator is not null
  and cp.operator !~ '^\(.*\)$'
group by cp.operator;

-- eindeutig: Voraussetzung fuer REFRESH ... CONCURRENTLY
create unique index idx_cpoc_operator on core.charge_point_operator_counts (operator);

comment on materialized view core.charge_point_operator_counts is
  'Anzahl aktiver Ladepunkte je Betreiber (ohne null und Platzhalter in Klammern), abgeleitet aus core.charge_point_map; Quelle von core.charge_point_operator_options. Wird zusammen mit der Kopie per core.refresh_charge_point_map() alle 15 Minuten aktualisiert. Siehe Migration 20261026220000.';

create or replace function core.refresh_charge_point_map()
returns void
language sql
security definer
set search_path = core, public
as $$
  refresh materialized view concurrently core.charge_point_map;
  refresh materialized view concurrently core.charge_point_operator_counts;
$$;

create or replace function core.charge_point_operator_options(p_min_stations int default 5)
returns table (
    operator text,
    station_count bigint
)
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select oc.operator, oc.station_count
    from core.charge_point_operator_counts oc
    where oc.station_count >= p_min_stations
    order by oc.operator;
end;
$$;
