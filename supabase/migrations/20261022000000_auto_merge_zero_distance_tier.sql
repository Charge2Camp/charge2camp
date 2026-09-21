-- Fortsetzung von 20261021000000/20261021010000/20261021020000: Nutzeranfrage
-- (zweite Runde, ueber 17.000 offene Paare nach dem ersten Automerge-Lauf --
-- die Zahl war vorher durch den PostgREST max_rows=5000-Cap im Dashboard
-- verdeckt, siehe 20261022 Chatverlauf/max_rows-Fix) -- explizite Vorgabe:
-- "alle mit Abstand 0m zusammenfuehren".
--
-- Stichprobe gegen Prod (15 zufaellige Paare aus den bisher durch die
-- Betreiber-Schutzregel ausgeschlossenen 0m-Paaren, ca. 6.467 insgesamt):
-- durchweg dieselbe physische Station -- OCM traegt haeufig den
-- Roaming-/EMSP-Netzwerknamen als "operator" ein (z. B. "ladenetz.de",
-- "EnBW (D)", "Izivia (Sodetrel)", "Alizé Liberté", "pass pass électrique"),
-- die nationale Quelle den tatsaechlichen Standort-/Netzbetreiber (z. B.
-- "EnBW mobility+ AG und Co.KG", "Stadtwerke Tecklenburger Land GmbH & Co.
-- KG") -- beides bezeichnet denselben Ladepunkt, die Betreiber-Strings sind
-- nur strukturell zu verschieden fuer die bisherige trigram-Schwelle (0.35).
-- Exakt identische Koordinaten (0.0m, nicht nur "nah") sind ein staerkeres
-- Signal als jeder Adress-/Namens-/Betreiber-Abgleich -- deshalb neue Tier 4
-- OHNE Betreiber-Schutzregel, nur fuer distance_m = 0.
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
    v_run_started timestamptz := now();
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    for v_pair in
        with pairs as (
            select
                d.key_a, d.key_b, d.distance_m,
                a.id as a_id, b.id as b_id,
                a.name as name_a, b.name as name_b,
                core.normalize_operator_for_dedup(a.operator) as op_a,
                core.normalize_operator_for_dedup(b.operator) as op_b,
                core.normalize_address_for_dedup(a.address) as addr_a,
                core.normalize_address_for_dedup(b.address) as addr_b,
                a.postcode as pc_a, b.postcode as pc_b,
                a.city as city_a, b.city as city_b
            from core.charge_point_duplicate d
            join core.charge_point a on a.external_key = d.key_a
            join core.charge_point b on b.external_key = d.key_b
            where not exists (
                select 1 from core.duplicate_dismissal x
                where x.entity_type = 'charge_point'
                  and ((x.key_a = d.key_a and x.key_b = d.key_b) or (x.key_a = d.key_b and x.key_b = d.key_a))
            )
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

        insert into core.charge_point_duplicate_auto_merge_log (tier, keep_key, removed_key, distance_m, removed_snapshot)
        values (v_pair.match_tier, v_b.external_key, v_a.external_key, v_pair.distance_m, to_jsonb(v_a));

        perform core.merge_charge_points(
            p_keep_id => v_b.id,
            p_remove_id => v_a.id,
            p_name => v_b.name,
            p_operator => v_b.operator,
            p_network => v_b.network,
            p_address => v_b.address,
            p_postcode => v_b.postcode,
            p_city => v_b.city,
            p_country_code => v_b.country_code,
            p_access_type => v_b.access_type,
            p_is_operational => v_b.is_operational
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
  'Wie core.auto_merge_charge_point_duplicates() (20261021000000), aber auf p_limit Paare pro Aufruf begrenzt (PostgREST/Pooler-Statement-Timeout ~8-9s) -- wiederholt aufrufen, bis 0 Zeilen zurueckkommen. Tier 4 (20261022000000): distance_m = 0 wird immer gemergt, auch bei Betreiber-Konflikt -- exakt identische Koordinaten sind ein staerkeres Signal als jeder Adress-/Namensabgleich.';
