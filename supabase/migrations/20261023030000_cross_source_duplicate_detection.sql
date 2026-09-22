-- Nutzermeldung: 3 identische "Aral Pulse"-Stationen in Garching bei
-- Muenchen (Schleissheimer Strasse 124, alle 300kW) tauchten nirgends als
-- Dublette auf:
--   bnetza:1055418, bnetza:1055038 (zwei BNetzA-Zeilen, ~30m auseinander,
--     leicht unterschiedliche Koordinaten -- BNetzA listet jede einzelne
--     Ladeeinrichtung separat, siehe Nutzerkommentar)
--   manual:7bfea076-... (manuell angelegt, manual_override=true)
--
-- Ursache: core.charge_point_duplicate (core.refresh_charge_point_duplicates,
-- 20261019020000/060000) vergleicht AUSSCHLIESSLICH OCM (source='ocm') gegen
-- alle anderen Quellen -- eine bewusste Scope-Einschraenkung aus
-- Performancegruenden (63k statt 234k Ladepunkte als aeussere Seite). BNetzA-
-- gegen-BNetzA oder BNetzA-gegen-admin_manual wird dadurch NIE verglichen.
--
-- Die eigentlich fuer genau diesen Fall gedachte Funktion
-- core.consolidate_bnetza_same_location() (20261019070000, "BNetzA
-- registriert eine Zeile pro Ladeeinrichtung, nicht pro Standort -- Vorgabe:
-- als EIN Punkt mit kumulierter Anschlusszahl listen") ist NIE erfolgreich
-- gelaufen -- sie war an den kaputten Minuten-Cron-Job gekoppelt (siehe
-- Chatverlauf: Ursache des Disk-voll-Vorfalls, 2026-09-21), jeder Lauf
-- scheiterte am Statement-Timeout, bevor auch nur ein Ladepark
-- zusammengefasst wurde. Ausserdem gruppiert sie nur nach EXAKT identischen
-- Koordinaten -- funktioniert strukturell nicht, weil BNetzA fuer
-- Einzelsaeulen desselben Ladeparks unterschiedliche (wenn auch nahe)
-- Koordinaten liefert (Nutzerbestaetigung).
--
-- Fix: core.refresh_charge_point_duplicates() vergleicht jetzt JEDE
-- core.charge_point-Zeile gegen ihren naechsten Nachbarn, unabhaengig von
-- der Quelle (auch selbe Quelle) -- die bereits bewaehrte adress-/namens-/
-- betreiberbasierte Tier-Logik (20261021000000 ff., robust gegen GPS-
-- Jitter) uebernimmt damit automatisch auch die BNetzA-Ladepark-
-- Konsolidierung, statt sich auf exakte Koordinatengleichheit zu verlassen.
-- core.consolidate_bnetza_same_location() bleibt bestehen (harmlos, nicht
-- mehr per Cron eingehaengt), wird aber durch dieses generellere System
-- ersetzt/ueberfluessig.
--
-- Da Paare jetzt zwischen JEDER Quellenkombination entstehen koennen (nicht
-- mehr garantiert "key_a=OCM, key_b=hoeher priorisiert"), muss der Automerge
-- den Gewinner pro Paar dynamisch bestimmen statt "key_b gewinnt immer"
-- anzunehmen: manual_override zuerst (Paare mit EINER geschuetzten Seite
-- werden weiterhin nie automatisch gemergt, siehe 20261023000000), sonst
-- core.source_registry.priority, bei Gleichstand (z. B. zwei BNetzA-Zeilen)
-- der lexikographisch kleinere external_key (deterministisch, stabil ueber
-- Reimporte).
insert into core.source_registry (source_id, source_name, source_type, country, priority, update_frequency)
values ('admin_manual', 'Manuell im Admin-Dashboard angelegt', 'MANUAL_CHARGE2CAMP', null, 100, 'bei Bedarf')
on conflict (source_id) do nothing;

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

comment on function core.refresh_charge_point_duplicates() is
  'Befuellt core.charge_point_duplicate neu (TRUNCATE + INSERT) -- ab 20261023030000 quellenuebergreifend (auch selbe Quelle gegeneinander, z. B. zwei BNetzA-Zeilen desselben Ladeparks), vorher nur OCM gegen andere Quellen. Braucht bei aktueller Groesse mehrere Minuten -- nur ueber pg_cron aufrufen, nie synchron aus der App/Admin heraus.';

create or replace function core.auto_merge_charge_point_duplicates_batch(p_limit int default 150)
returns table(tier text, merged_count bigint)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_pair record;
    v_a core.charge_point%rowtype;
    v_b core.charge_point%rowtype;
    v_keep core.charge_point%rowtype;
    v_remove core.charge_point%rowtype;
    v_run_started timestamptz := now();
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    for v_pair in
        with pairs as (
            select
                d.key_a, d.key_b, d.distance_m,
                a.id as a_id, b.id as b_id,
                a.name as name_a, b.name as name_b,
                a.manual_override as override_a, b.manual_override as override_b,
                coalesce(pa.priority, -1) as priority_a, coalesce(pb.priority, -1) as priority_b,
                core.normalize_operator_for_dedup(a.operator) as op_a,
                core.normalize_operator_for_dedup(b.operator) as op_b,
                core.normalize_address_for_dedup(a.address) as addr_a,
                core.normalize_address_for_dedup(b.address) as addr_b,
                a.postcode as pc_a, b.postcode as pc_b,
                a.city as city_a, b.city as city_b
            from core.charge_point_duplicate d
            join core.charge_point a on a.external_key = d.key_a
            join core.charge_point b on b.external_key = d.key_b
            left join core.source_registry pa on pa.source_id = a.source
            left join core.source_registry pb on pb.source_id = b.source
            where not exists (
                select 1 from core.duplicate_dismissal x
                where x.entity_type = 'charge_point'
                  and ((x.key_a = d.key_a and x.key_b = d.key_b) or (x.key_a = d.key_b and x.key_b = d.key_a))
            )
            and not a.manual_override
            and not b.manual_override
        ),
        scored as (
            select *,
                case when op_a is not null and op_b is not null then similarity(op_a, op_b) end as op_sim,
                case when addr_a is not null and addr_b is not null then similarity(addr_a, addr_b) end as addr_sim,
                similarity(coalesce(name_a, ''), coalesce(name_b, '')) as name_sim,
                (op_a is not null and op_b is not null and op_a <> op_b and similarity(op_a, op_b) < 0.35) as operator_conflict
            from pairs
        ),
        tiered as (
            select *,
                case
                    when addr_a is not null and addr_b is not null and addr_sim >= 0.55
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                         and (op_a is null or op_b is null or op_a = op_b or op_sim >= 0.5)
                         and not operator_conflict
                        then 'tier1_address_operator'
                    when name_sim >= 0.6 and op_a is not null and op_b is not null
                         and (op_a = op_b or op_sim >= 0.5) and distance_m::numeric <= 80
                         and not operator_conflict
                        then 'tier2_name_operator_80m'
                    when distance_m::numeric <= 15 and pc_a is not null and pc_a = pc_b
                         and city_a is not null and city_a = city_b
                         and addr_sim >= 0.5
                         and not operator_conflict
                        then 'tier3_tight_geo_address'
                    when distance_m::numeric = 0
                        then 'tier4_zero_distance'
                    when distance_m::numeric <= 5
                        then 'tier5_near_zero_5m'
                    when op_a is not null and op_b is not null
                         and op_sim >= 0.2 and op_sim < 0.35
                         and addr_a is not null and addr_b is not null and addr_sim >= 0.55
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                        then 'tier6_address_loose_operator'
                    when (op_a is null or op_b is null)
                         and addr_a is not null and addr_b is not null and addr_sim >= 0.5
                         and distance_m::numeric <= 20
                        then 'tier7_address_unknown_operator_20m'
                    when addr_a is not null and addr_b is not null and addr_sim >= 0.7
                         and distance_m::numeric <= 20
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                        then 'tier8_very_strong_address_20m'
                    when addr_a is not null and addr_b is not null and addr_a = addr_b
                        then 'tier9_exact_address'
                    else null
                end as match_tier
            from scored
        )
        select * from tiered
        where match_tier is not null
        order by key_a
        limit p_limit
    loop
        select * into v_a from core.charge_point where id = v_pair.a_id;
        select * into v_b from core.charge_point where id = v_pair.b_id;
        if not found or v_a.id is null or v_b.id is null then
            continue;
        end if;
        if v_a.manual_override or v_b.manual_override then
            continue;
        end if;

        -- Gewinner dynamisch bestimmen (Prioritaet, bei Gleichstand
        -- kleinerer external_key) -- key_a/key_b implizieren seit
        -- 20261023030000 keine feste Quellen-Reihenfolge mehr.
        if coalesce((select priority from core.source_registry where source_id = v_a.source), -1)
           >= coalesce((select priority from core.source_registry where source_id = v_b.source), -1) then
            if v_a.source = v_b.source and v_a.external_key > v_b.external_key then
                v_keep := v_b; v_remove := v_a;
            else
                v_keep := v_a; v_remove := v_b;
            end if;
        else
            v_keep := v_b; v_remove := v_a;
        end if;

        insert into core.charge_point_duplicate_auto_merge_log (tier, keep_key, removed_key, distance_m, removed_snapshot)
        values (v_pair.match_tier, v_keep.external_key, v_remove.external_key, v_pair.distance_m, to_jsonb(v_remove));

        perform core.merge_charge_points(
            p_keep_id => v_keep.id,
            p_remove_id => v_remove.id,
            p_name => v_keep.name,
            p_operator => v_keep.operator,
            p_network => v_keep.network,
            p_address => v_keep.address,
            p_postcode => v_keep.postcode,
            p_city => v_keep.city,
            p_country_code => v_keep.country_code,
            p_access_type => v_keep.access_type,
            p_is_operational => v_keep.is_operational
        );
    end loop;

    delete from core.charge_point_duplicate d
    where not exists (select 1 from core.charge_point where external_key = d.key_a)
       or not exists (select 1 from core.charge_point where external_key = d.key_b);

    return query
        select l.tier, count(*)
        from core.charge_point_duplicate_auto_merge_log l
        where l.merged_at >= v_run_started
        group by l.tier;
end;
$$;

comment on function core.auto_merge_charge_point_duplicates_batch(int) is
  'Wie core.auto_merge_charge_point_duplicates() (20261021000000). Ab 20261023030000 quellenuebergreifend (core.charge_point_duplicate deckt jetzt auch selbe-Quelle-Paare ab, z. B. zwei BNetzA-Zeilen desselben Ladeparks) -- Gewinner pro Paar wird dynamisch ueber core.source_registry.priority bestimmt (bei Gleichstand kleinerer external_key), nicht mehr "key_b immer". manual_override schuetzt weiterhin auf beiden Seiten (20261023000000).';
