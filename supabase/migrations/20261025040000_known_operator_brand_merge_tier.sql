-- Nutzervorgabe (2026-09-25): verbleibende Dubletten mit hoher (aber
-- < 100%) Adress-Aehnlichkeit geprueft -- groesster Block (~190 Paare) sind
-- KEIN Formatierungsproblem mehr, sondern derselbe Konzern unter
-- unterschiedlichem Marken-/Tochtergesellschafts-Namen in den Rohdaten
-- (z. B. "TotalEnergies Charging Services" vs. "TotalEnergies (FR)" vs.
-- "TotalEnergies Marketing France", "Lidl France" vs. "Lidl", "EWE Go
-- GmbH" vs. "SWB / EWE"). Tier 1 (core.auto_merge_charge_point_duplicates_
-- batch) verlangt op_sim >= 0.5 (Trigram-Aehnlichkeit der normalisierten
-- Betreiber-Strings) -- bei diesen Namenspaaren liegt die tatsaechliche
-- Aehnlichkeit oft darunter (z. B. "totalenergies charging services" vs.
-- "totalenergies" hat wenig gemeinsame Trigramme trotz eindeutig gleicher
-- Marke), Tier 8 (kein Betreiberkriterium) greift nur bei addr_sim >= 0.7
-- UND passender/fehlender PLZ.
--
-- Bewusst NICHT per generischer Aehnlichkeitsschwelle geloest (Risiko:
-- "Fastned Deutschland GmbH" vs. "Shell Deutschland GmbH" sind
-- KONKURRIERENDE Betreiber, keine Marken-Variante) -- stattdessen eine
-- kuratierte, enge Zuordnungstabelle NUR fuer eindeutig identifizierte
-- Konzerne (Nutzerentscheidung: "kuratierte Alias-Tabelle nur fuer
-- eindeutige Faelle"). core.operator_brand_family() ordnet einen
-- normalisierten Betreiber-String einer von 11 bekannten Marken-Familien
-- zu (oder NULL, wenn unbekannt -- bleibt dann wie bisher im manuellen
-- Dashboard).
create or replace function core.operator_brand_family(p_operator text)
returns text
language sql
immutable
as $$
    select case
        when n is null then null
        when n like '%totalenergies%' then 'totalenergies'
        when n like '%lidl%' then 'lidl'
        when n like '%tesla%' then 'tesla'
        when n like '%zephyre%' then 'zephyre'
        when n like '%engie%' then 'engie'
        when n like '%ewe%' then 'ewe'
        when n like '%e on drive%' then 'eon'
        when n like '%allego%' then 'allego'
        when n like '%mobilize%' then 'mobilize'
        when n like '%rhönenergie%' then 'rhoenenergie'
        when n like '%pfalzwerke%' then 'pfalzwerke'
        else null
    end
    from (select core.normalize_operator_for_dedup(p_operator) as n) s
$$;

comment on function core.operator_brand_family(text) is
  'Ordnet core.normalize_operator_for_dedup()-Ergebnis einer von 11 kuratierten, eindeutig identifizierten Marken-Familien zu (TotalEnergies/Lidl/Tesla/Zephyre/Engie/EWE/E.ON/Allego/Mobilize/RhönEnergie/Pfalzwerke) oder NULL. Bewusst eng gefasst -- nur Konzerne, bei denen zwei unterschiedliche Betreiber-Strings in core.charge_point NACHWEISLICH denselben realen Betreiber beschreiben (Nutzeranalyse 2026-09-25, siehe 20261025040000). NICHT als generische Aehnlichkeitsheuristik gedacht -- neue Faelle nur nach expliziter Pruefung ergaenzen, sonst droht dieselbe Fehlerklasse wie der 1.201-Zeilen-Vorfall (20261023000000), nur ueber Betreiber statt Adresse.';

-- Tier 1b eingefuegt: gleiche Sicherheitsbedingungen wie Tier 1
-- (addr_sim >= 0.55, PLZ passt oder unbekannt), aber Betreiber-Match ueber
-- die kuratierte Marken-Familie statt op_sim -- fuer beide Varianten der
-- Automerge-Funktion (batch fuer den naechtlichen Cron-Lauf, non-batch
-- fuer manuelle Entwickler-Aufrufe), analog zu allen vorherigen
-- Tier-Ergaenzungen.
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
                core.operator_brand_family(a.operator) as brand_a,
                core.operator_brand_family(b.operator) as brand_b,
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
                    when addr_a is not null and addr_b is not null and addr_sim >= 0.55
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                         and brand_a is not null and brand_a = brand_b
                        then 'tier1b_known_operator_brand'
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
                         and distance_m::numeric <= 300
                         and (city_a is null or city_b is null or city_a = city_b)
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
  'Wie core.auto_merge_charge_point_duplicates() (20261021000000). Ab 20261023030000 quellenuebergreifend, ab 20261024010000 mit eigener Distanzgrenze fuer Tier 9, ab 20261025040000 mit Tier 1b (kuratierte Betreiber-Marken-Familie, core.operator_brand_family()) fuer Faelle wie "TotalEnergies Charging Services" vs. "TotalEnergies (FR)", die op_sim >= 0.5 verfehlen. manual_override schuetzt weiterhin auf beiden Seiten (20261023000000).';

create or replace function core.auto_merge_charge_point_duplicates()
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
                core.operator_brand_family(a.operator) as brand_a,
                core.operator_brand_family(b.operator) as brand_b,
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
                    when addr_a is not null and addr_b is not null and addr_sim >= 0.55
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                         and brand_a is not null and brand_a = brand_b
                        then 'tier1b_known_operator_brand'
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
                         and distance_m::numeric <= 300
                         and (city_a is null or city_b is null or city_a = city_b)
                        then 'tier9_exact_address'
                    else null
                end as match_tier
            from scored
        )
        select * from tiered
        where match_tier is not null
        order by key_a
    loop
        select * into v_a from core.charge_point where id = v_pair.a_id;
        select * into v_b from core.charge_point where id = v_pair.b_id;
        if not found or v_a.id is null or v_b.id is null then
            continue;
        end if;
        if v_a.manual_override or v_b.manual_override then
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

-- Kein automatischer Nachlauf hier (anders als bei den vorherigen
-- Adress-Normalisierungs-Migrationen): core.auto_merge_all_charge_point_
-- duplicates() kann je nach Rueckstau laenger laufen als das Statement-
-- Timeout beim Anwenden der Migration selbst erlaubt (siehe
-- 20261023070000-Kommentar: "kann mehrere Minuten laufen") -- der bereits
-- bestehende naechtliche Cron-Job (core.refresh_all_quality_data(),
-- 20261023070000) faengt neue Tier-1b-Treffer ab dem naechsten Lauf
-- automatisch ab. Fuer einen sofortigen Nachlauf: core.
-- auto_merge_charge_point_duplicates_batch(150) mehrfach einzeln aufrufen
-- (jeder Aufruf bleibt unterhalb des Timeouts, siehe Betriebsnotiz).
