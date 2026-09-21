-- Fortsetzung von 20261022000000: dritte Runde nach Nutzer-Review der
-- verbliebenen 7.747 Paare (Stichproben je Gruppe im Chat freigegeben,
-- 2026-09-21). Drei weitere Tiers:
--
--   Tier 5 "Nahe 0m" (0m < Abstand <= 5m): wie Tier 4, aber statt exakt 0m
--     ein kleiner Toleranzradius fuer GPS-Rundungsdifferenzen zwischen
--     Quellen. Stichprobe (10 zufaellige Paare): durchweg dieselbe Station.
--   Tier 6 "Adresse passt, Betreiber-Aehnlichkeit 20-35%": Adress-Match wie
--     Tier 1 (trigram >= 0.55, gleiche PLZ falls vorhanden), aber Betreiber-
--     Trigram-Aehnlichkeit im Band 0.2-0.35 statt der bisherigen 0.5/0.35-
--     Schwellen zugelassen -- deckt Faelle ab, in denen unterschiedlich
--     lange Firmennamen derselben Marke (z. B. "EnBW (D)" vs. "EnBW
--     mobility+ AG und Co.KG", "Tesla (including non-tesla)" vs. "TESLA
--     France SARL") wegen der Laengendifferenz eine niedrige Trigram-
--     Aehnlichkeit haben, obwohl es eindeutig dieselbe Firma ist.
--   Tier 7 "Ein Betreiber unbekannt, Adresse passt, <=20m": wenn eine Seite
--     gar keinen auswertbaren Betreiber hat (NULL/Platzhalter, siehe
--     core.normalize_operator_for_dedup()), reicht Adress-Aehnlichkeit
--     >= 0.5 UND Abstand <= 20m als Signal.
--
-- Bewusst NICHT automatisiert (bleibt manuell, ca. 5.180 Paare): eindeutig
-- unterschiedliche Adressen/Betreiber ohne belastbares gemeinsames Signal,
-- z. B. "Parking de la concession" vs. "BMW Montargis powered by DRIVECO"
-- (97m Abstand, Adress-Aehnlichkeit 0.08).
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
  'Wie core.auto_merge_charge_point_duplicates() (20261021000000), aber auf p_limit Paare pro Aufruf begrenzt (PostgREST/Pooler-Statement-Timeout ~8-9s) -- wiederholt aufrufen, bis 0 Zeilen zurueckkommen. Tier 4/5 (20261022000000/010000): Abstand <= 5m wird immer gemergt. Tier 6/7 (20261022010000): Adress-bestaetigte Paare mit loser bzw. fehlender Betreiber-Uebereinstimmung, nach Nutzer-Review der Stichproben freigegeben.';
