-- Nutzervorgabe (2026-09-22): "alle Dubletten mit Adresse 100% ähnlich
-- zusammenführen". Analyse: 182 offene Kandidatenpaare mit exakter
-- normalisierter Adressuebereinstimmung (core.normalize_address_for_dedup,
-- dieselbe Funktion wie tier9_exact_address), alle innerhalb 300m. Der
-- bisherige generelle Automerge (core.auto_merge_charge_point_duplicates_
-- batch, tier9) erfasst davon nicht alle, weil tier9 zusaetzlich einen
-- EXAKTEN Stadt-String-Vergleich verlangt -- viele Faelle scheitern nur an
-- Schreibvarianten wie "Frankfurt am Main" vs. "Frankfurt", "Halle" vs.
-- "Halle (Saale)", "leipzig" vs. "Leipzig" (Gross-/Kleinschreibung),
-- "Napoli" vs. "Naples". Und core.auto_merge_charge_point_duplicates_batch
-- blockiert grundsaetzlich jedes Paar mit manual_override auf einer Seite
-- (20261023000000), unabhaengig von der Quellenkombination -- nicht nur
-- BNetzA-vs-manual wie die engere Regel aus 20261024020000.
--
-- Diese Funktion ist bewusst NOCH enger gefasst als "irgendein Tier
-- reicht": NUR exakte, normalisierte Adressgleichheit (staerkstes
-- verfuegbares Signal, keine unscharfe Aehnlichkeit) zaehlt, Stadt-
-- Abweichung wird toleriert (normalisiert per lower(trim(...)) verglichen,
-- da die meisten Abweichungen wie oben reine Schreibvarianten sind).
-- Gewinner: geschuetzte (manual_override) Seite gewinnt immer, wenn genau
-- eine Seite geschuetzt ist (Admin-Korrektur bleibt massgeblich) -- sind
-- BEIDE Seiten geschuetzt, wird das Paar bewusst NICHT automatisch
-- zusammengefuehrt (zwei unabhaengige, potenziell widerspruechliche
-- manuelle Eintraege -- 3 Faelle, bleiben im manuellen Dashboard). Sind
-- beide Seiten ungeschuetzt, gewinnt core.source_registry.priority (bei
-- Gleichstand kleinerer external_key), analog zu core.
-- auto_merge_charge_point_duplicates_batch().
create or replace function core.merge_exact_address_duplicates(p_limit int default 500)
returns table(merged_count bigint, both_protected_skipped bigint)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_pair record;
    v_keep core.charge_point%rowtype;
    v_remove core.charge_point%rowtype;
    v_merged bigint := 0;
    v_both_protected bigint := 0;
    v_run_started timestamptz := now();
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    for v_pair in
        select
            d.key_a, d.key_b,
            a.id as a_id, b.id as b_id,
            a.manual_override as override_a, b.manual_override as override_b,
            coalesce(pa.priority, -1) as priority_a, coalesce(pb.priority, -1) as priority_b
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
        and core.normalize_address_for_dedup(a.address) is not null
        and core.normalize_address_for_dedup(b.address) is not null
        and core.normalize_address_for_dedup(a.address) = core.normalize_address_for_dedup(b.address)
        order by d.key_a
        limit p_limit
    loop
        if v_pair.override_a and v_pair.override_b then
            v_both_protected := v_both_protected + 1;
            continue;
        end if;

        select * into v_keep from core.charge_point where id = case
            when v_pair.override_a then v_pair.a_id
            when v_pair.override_b then v_pair.b_id
            when v_pair.priority_a >= v_pair.priority_b then v_pair.a_id
            else v_pair.b_id
        end;
        select * into v_remove from core.charge_point where id = case
            when v_pair.override_a then v_pair.b_id
            when v_pair.override_b then v_pair.a_id
            when v_pair.priority_a >= v_pair.priority_b then v_pair.b_id
            else v_pair.a_id
        end;
        if not found or v_keep.id is null or v_remove.id is null then
            continue;
        end if;
        -- Doppelte Absicherung (Status koennte sich seit der
        -- Kandidaten-Auswahl geaendert haben).
        if v_keep.manual_override and v_remove.manual_override then
            continue;
        end if;

        insert into core.charge_point_duplicate_auto_merge_log (tier, keep_key, removed_key, distance_m, removed_snapshot)
        select 'exact_address_manual_merge', v_keep.external_key, v_remove.external_key, d.distance_m, to_jsonb(v_remove)
        from core.charge_point_duplicate d
        where (d.key_a = v_pair.key_a and d.key_b = v_pair.key_b);

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
        v_merged := v_merged + 1;
    end loop;

    delete from core.charge_point_duplicate d
    where not exists (select 1 from core.charge_point where external_key = d.key_a)
       or not exists (select 1 from core.charge_point where external_key = d.key_b);

    return query select v_merged, v_both_protected;
end;
$$;

comment on function core.merge_exact_address_duplicates(int) is
  'Einmalige/manuell ausloesbare Ergaenzung zu core.auto_merge_charge_point_duplicates_batch(): merged ALLE Paare mit exakter normalisierter Adressuebereinstimmung, unabhaengig von Quellenkombination/Betreiber/Stadt-Schreibvariante -- auch wenn manual_override nur auf EINER Seite gesetzt ist (die geschuetzte Seite gewinnt dann immer). Beide Seiten geschuetzt: kein Automerge, bleibt manuelles Review. Siehe 20261024090000, Nutzervorgabe "alle Dubletten mit Adresse 100% ähnlich zusammenführen".';

grant execute on function core.merge_exact_address_duplicates(int) to service_role;

select * from core.merge_exact_address_duplicates(500);
