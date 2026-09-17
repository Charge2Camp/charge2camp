-- Nutzerwunsch: Der "Ladeanbieter"-Filter auf /ladepunkte soll nicht mehr
-- die feste 10er-Liste (CHARGING_PROVIDERS, charging-providers.ts) zeigen,
-- sondern ALLE tatsaechlich in der Datenbank vorkommenden Anbieter (core.
-- charge_point.operator) mit mindestens 5 auffindbaren (aktiven) Stationen.
--
-- Eine Aggregation dieser Groessenordnung (ueber 18.000 core.charge_point-
-- Zeilen) client-/JS-seitig zu holen wuerde entweder am PostgREST-
-- max_rows-Limit (5000, siehe supabase/config.toml) scheitern oder
-- mehrfache paginierte Requests bei JEDEM Aufruf von /ladepunkte noetig
-- machen -- eine einzelne GROUP BY-Abfrage direkt in Postgres ist hier
-- deutlich guenstiger. Gleiches Muster/gleiche Zugriffspruefung wie
-- core.charge_point_filter_options() (20260930080000_charge_point_admin_list.sql):
-- nur per Service-Role (also ueber createAdminClient() serverseitig in der
-- Next.js-App, siehe fetchChargingStationOperatorOptions in
-- charging-stations.ts) oder als Admin aufrufbar -- kein Grant an
-- anon/authenticated noetig.

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
    select cp.operator, count(*) as station_count
    from core.charge_point cp
    where cp.operator is not null
      and cp.is_active = true
    group by cp.operator
    having count(*) >= p_min_stations
    order by cp.operator;
end;
$$;
