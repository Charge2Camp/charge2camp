-- Fortsetzung von 20261023040000: die 3. Zeile im Garching-Beispiel
-- (manuell angelegt, identische Adresse "Schleissheimer Strasse 124") liegt
-- 118-127m von den beiden BNetzA-Zeilen entfernt -- ausserhalb des
-- bisherigen 100m-Radius fuer Schnelllader, deshalb kein Kandidat trotz
-- exakter Adress-Uebereinstimmung. Radius fuer Schnelllader auf 150m
-- angehoben -- risikoarm, weil manual_override-Zeilen ohnehin nie
-- automatisch gemergt werden (20261023000000); die Erweiterung sorgt nur
-- dafuer, dass solche Faelle ueberhaupt im manuellen Dashboard auftauchen.
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
          and st_dwithin(a.geom, b.geom, 150)
        order by a.geom <-> b.geom
        limit 5
    ) b
    where st_dwithin(
        a.geom, b.geom,
        case when coalesce(
                    (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = a.id),
                    a.max_power_kw >= 43
                  ) or b.b_is_fast
             then 150 else 25 end
    );
end;
$$;
