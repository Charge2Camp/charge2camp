-- Fortsetzung von 20261023030000: mit "limit 1" (nur der naechste
-- Nachbar) verbrauchen sich zwei nahe beieinanderliegende BNetzA-Zeilen
-- gegenseitig als "naechster Nachbar" -- ein dritter, etwas weiter
-- entfernter Duplikat-Kandidat (z. B. eine manuell angelegte Zeile
-- desselben Ladeparks) bekommt dadurch nie eine Paarung und taucht auch
-- nicht im manuellen Dashboard auf, obwohl er dort zur Pruefung gehoert
-- (Nutzerbeispiel Garching: 2 BNetzA-Zeilen + 1 manuelle Zeile, nur die
-- beiden BNetzA-Zeilen wurden als Paar erkannt). Limit auf 5 erhoeht, damit
-- Ladeparks mit mehreren Zeilen vollstaendig erfasst werden.
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
