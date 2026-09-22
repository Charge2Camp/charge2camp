-- Nutzerwunsch: der Automerge (core.auto_merge_charge_point_duplicates_batch,
-- 20261021000000 ff.) soll nicht mehr manuell angestossen werden muessen --
-- der taegliche pg_cron-Job "refresh-all-quality-data" (03:00 UTC,
-- 20261019030000) berechnet core.charge_point_duplicate bereits jede Nacht
-- neu (seit 20261023030000 quellenuebergreifend), aber ohne die frischen
-- Kandidaten anschliessend automatisch zu verarbeiten -- neue Dubletten aus
-- taeglichen OCM/BNetzA/IRVE-Reimporten blieben dadurch bis zum naechsten
-- manuellen Lauf liegen (siehe Chatverlauf: 23.832 frische IRVE/BNetzA-
-- Kandidaten nach dem 03:00-Uhr-Refresh heute).
--
-- core.auto_merge_all_charge_point_duplicates() ruft die batch-Funktion
-- wiederholt auf (gleiches Muster wie das bisherige manuelle Bash-Skript),
-- bis keine weiteren Tier-Treffer mehr uebrig sind -- in EINER Funktion
-- statt vieler einzelner PostgREST-Aufrufe, deshalb hier (anders als beim
-- manuellen Weg ueber PostgREST) kein Statement-Timeout-Problem: der
-- gesamte Cron-Job laeuft als Hintergrund-Worker direkt im
-- Datenbankprozess.
create or replace function core.auto_merge_all_charge_point_duplicates()
returns table(tier text, merged_count bigint)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_batch record;
    v_total bigint := 0;
    v_iterations int := 0;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    loop
        v_iterations := v_iterations + 1;
        select coalesce(sum(b.merged_count), 0) into v_total
        from core.auto_merge_charge_point_duplicates_batch(150) b;

        exit when v_total = 0 or v_iterations > 2000;
    end loop;

    return query
        select l.tier, count(*)
        from core.charge_point_duplicate_auto_merge_log l
        where l.merged_at >= now() - interval '1 hour'
        group by l.tier;
end;
$$;

comment on function core.auto_merge_all_charge_point_duplicates() is
  'Ruft core.auto_merge_charge_point_duplicates_batch() wiederholt auf, bis keine Tier-Treffer mehr uebrig sind (Sicherheitsabbruch nach 2000 Iterationen = 300k Paaren). Nur ueber pg_cron aufrufen (core.refresh_all_quality_data(), 20261023070000), nicht synchron aus der App -- kann je nach Kandidatenzahl mehrere Minuten laufen.';

grant execute on function core.auto_merge_all_charge_point_duplicates() to service_role;

-- refresh_all_quality_data() um den Automerge-Schritt erweitert -- laeuft
-- weiterhin durch den bestehenden Advisory Lock (20261019080000) geschuetzt
-- gegen Ueberlappung mit sich selbst.
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
    perform core.auto_merge_all_charge_point_duplicates();
    perform core.refresh_quality_checks();
end;
$$;
