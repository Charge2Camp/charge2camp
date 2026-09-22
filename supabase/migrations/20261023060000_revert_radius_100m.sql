-- Revert von 20261023050000: 150m-Radius liess selbst den Hintergrund-Aufruf
-- von core.refresh_charge_point_duplicates() (ueber die Supabase Management
-- API, nicht PostgREST) am Statement-Timeout scheitern -- die zusaetzliche
-- Kandidatenflaeche pro Punkt war zu teuer. Zurueck auf 100m (mit limit 5,
-- aus 20261023040000, das erfolgreich lief). Der konkrete Garching-
-- Ausreisser (118-127m entfernt) bleibt ein manueller Einzelfall im
-- Dashboard -- ein groesserer Radius braeuchte eine echte Batch-/Cron-
-- Loesung statt eines einzelnen TRUNCATE+INSERT-Statements, das hier nicht
-- weiterverfolgt wird.
create or replace function core.refresh_charge_point_duplicates()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    truncate table core.charge_point_duplicate;

    insert into core.charge_point_duplicate (key_a, key_b, operator_a, operator_b, distance_m)
    select a.external_key, b.external_key, a.operator, b.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1)
    from core.charge_point a
    cross join lateral (
        select b.external_key, b.geom, b.operator,
               coalesce(
                 (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = b.id),
                 b.max_power_kw >= 43
               ) as b_is_fast
        from core.charge_point b
        where b.external_key > a.external_key
          and st_dwithin(a.geom, b.geom, 100)
        order by a.geom <-> b.geom
        limit 5
    ) b
    where st_dwithin(
        a.geom, b.geom,
        case when coalesce(
                    (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = a.id),
                    a.max_power_kw >= 43
                  ) or b.b_is_fast
             then 100 else 25 end
    );
end;
$$;
