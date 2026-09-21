-- Zweimal in dieser Session ist ein "einmalig per Minuten-Cron angestossener"
-- Hintergrund-Job (core.refresh_all_quality_data(), core.
-- consolidate_bnetza_same_location()) vergessen worden zu unschedulen und
-- hat sich dadurch mit sich selbst ueberlappt (naechster Minuten-Tick startet,
-- bevor der vorherige fertig ist) -- beim zweiten Mal fuehrte das
-- (vermutlich durch die dadurch vervielfachte WAL-/Tabellen-Churn aus
-- wiederholten TRUNCATE/DELETE auf denselben Zeilen) zum Erreichen der
-- Datenbankgroessen-Quota und Read-Only-Modus. Statt weiter manuell daran zu
-- denken, das Unschedulen nicht zu vergessen: beide Funktionen ueberspringen
-- sich jetzt selbst, wenn bereits eine Instanz laeuft (Advisory Lock,
-- automatisch freigegeben am Ende der Transaktion) -- ein Ueberlappen ist
-- dadurch strukturell unmoeglich, unabhaengig davon, wie oft der Cron tickt.
create or replace function core.refresh_all_quality_data()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if not pg_try_advisory_xact_lock(hashtext('core.refresh_all_quality_data')) then
        raise notice 'core.refresh_all_quality_data() laeuft bereits -- uebersprungen.';
        return;
    end if;
    perform core.refresh_charge_point_duplicates();
    perform core.refresh_quality_checks();
end;
$$;

create or replace function core.consolidate_bnetza_same_location()
returns table(survivor_external_key text, merged_count int)
language plpgsql
security definer
set search_path = core, public
as $$
declare
    grp record;
    other_id uuid;
    v_survivor_id uuid;
    v_survivor_key text;
    v_is_operational boolean;
    v_merged_count int;
begin
    if not pg_try_advisory_xact_lock(hashtext('core.consolidate_bnetza_same_location')) then
        raise notice 'core.consolidate_bnetza_same_location() laeuft bereits -- uebersprungen.';
        return;
    end if;

    for grp in
        select array_agg(id order by
            manual_override desc,
            (regexp_replace(external_key, '\D', '', 'g'))::bigint
        ) as ids
        from core.charge_point
        where source = 'bundesnetzagentur'
        group by geom
        having count(*) > 1
    loop
        v_survivor_id := grp.ids[1];
        v_merged_count := 0;

        select external_key, is_operational into v_survivor_key, v_is_operational
        from core.charge_point where id = v_survivor_id;

        foreach other_id in array grp.ids[2:array_length(grp.ids, 1)]
        loop
            select v_is_operational or cp.is_operational into v_is_operational
            from core.charge_point cp where cp.id = other_id;

            perform core.merge_charge_points(
                v_survivor_id, other_id,
                (select name from core.charge_point where id = v_survivor_id),
                (select operator from core.charge_point where id = v_survivor_id),
                (select network from core.charge_point where id = v_survivor_id),
                (select address from core.charge_point where id = v_survivor_id),
                (select postcode from core.charge_point where id = v_survivor_id),
                (select city from core.charge_point where id = v_survivor_id),
                (select country_code from core.charge_point where id = v_survivor_id),
                (select access_type from core.charge_point where id = v_survivor_id),
                v_is_operational
            );
            v_merged_count := v_merged_count + 1;
        end loop;

        return query select v_survivor_key, v_merged_count;
    end loop;
end;
$$;
