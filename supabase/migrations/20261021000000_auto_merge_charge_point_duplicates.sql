-- Nutzerwunsch: die "Moegliche Dubletten (Ladepunkte)"-Liste ist auf ueber
-- 4000 offene Paare angewachsen -- zu viele fuer manuelle Einzelpruefung.
-- Automatisches Zusammenfuehren fuer Faelle, in denen man sich sicher sein
-- kann, dass es sich um denselben physischen Ladepunkt handelt; alles
-- andere bleibt weiterhin im manuellen Dashboard.
--
-- core.charge_point_duplicate hat key_a IMMER als OCM (niedrigste
-- Prioritaet, core.source_registry) und key_b IMMER als hoeher priorisierte
-- Quelle (Bundesnetzagentur/IRVE/admin_manual) -- verifiziert gegen die
-- Produktivdaten (28.111 offene Paare: source_a ausschliesslich 'ocm',
-- source_b 'bundesnetzagentur'/'irve'/'admin_manual', nie umgekehrt). Ein
-- Automerge behaelt deshalb immer B (config von core.merge_charge_points
-- unveraendert: alle Feldwerte kommen von B, A wird gelöscht) -- konsistent
-- mit der bereits bestehenden Prioritaetslogik in
-- core.absorb_technical_fields() (20261019000000).
--
-- Erkennungsregeln (Tiers, konservativ -- lieber ein Paar zu viel im
-- manuellen Review lassen als eine Fehlzusammenfuehrung):
--   Tier 1 "Adresse+Betreiber": normalisierte Adresse ausreichend aehnlich
--     (trigram similarity >= 0.55) UND (gleiche PLZ, falls beide vorhanden)
--     UND (Betreiber gleich ODER einer der beiden unbekannt/Platzhalter
--     ODER Betreiber-Aehnlichkeit >= 0.5). Deckt den in der Praxis
--     haeufigsten Fall ab: OCM liefert keinen echten Betreiber (nur
--     Adresse als Name, operator = NULL oder Platzhalter wie "(Business
--     Owner at Location)"), die nationale Quelle liefert den echten
--     Betreiber zur selben Adresse.
--   Tier 2 "Name+Betreiber, <=80m": Name UND Betreiber ausreichend
--     aehnlich (jeweils trigram similarity, Betreiber exakt oder >= 0.5)
--     UND Abstand <= 80m -- deckt Marken-/Netzwerk-Stationen ab, bei denen
--     Adressformat stark abweicht (z. B. Autobahn-Raststaetten), Name und
--     Betreiber (z. B. "Electra"/"Ionity"/"Fastned") aber eindeutig gleich
--     sind.
--   Tier 3 "Enge Geo-Uebereinstimmung": Abstand <= 15m UND gleiche PLZ UND
--     gleiche Stadt UND Adresse ausreichend aehnlich (trigram >= 0.5),
--     unabhaengig vom Betreiber -- deckt Faelle ab, in denen derselbe
--     Konzern unter leicht unterschiedlichem Namen auftritt (z. B. "Tesla
--     (Tesla-only charging)" vs. "Tesla Germany GmbH", "Ionity" vs. "IONITY
--     GmbH") und auf Meter genau derselbe Standort ist.
--
-- Schutzregel (nutzerseitig explizit gefordert -- "auch wenn der Betreiber
-- leicht unterschiedlich ist" heisst NICHT "voellig unterschiedlich"):
-- sind BEIDE Betreiber bekannt (kein NULL/Platzhalter) UND eindeutig
-- verschieden (weder exakt gleich noch trigram similarity >= 0.35), wird
-- das Paar IMMER vom Automerge ausgeschlossen, unabhaengig von Adresse/
-- Abstand -- verhindert Fehlzusammenfuehrungen an dicht belegten Hubs
-- (z. B. Raststaette mit mehreren unabhaengigen Betreibern im 100m-Radius).
--
-- Kalibrierung gegen die Produktivdaten (28.111 offene, nicht abgelehnte
-- Paare): Tier 1 = 13.022, Tier 2 = 569, Tier 3 = 320 (zusammen 13.911
-- Automerges), 11.337 durch die Betreiber-Schutzregel ausgeschlossen,
-- 2.866 ohne eindeutiges Signal -- beide Gruppen bleiben im manuellen
-- Dashboard. Stichproben aller Gruppen manuell gegengeprueft.

create or replace function core.normalize_operator_for_dedup(p text)
returns text
language sql
immutable
as $$
    select nullif(
        trim(both ' ' from
            regexp_replace(
                regexp_replace(
                    regexp_replace(lower(coalesce(p, '')), '\(.*?\)', ' ', 'g'),
                    '\mgmbh( ?& ?co\.? ?kg)?\M|\mag\M|\mse\M|\mkg\M|\me\.?v\.?\M|\mmbh\M|\m& ?co\.?\M',
                    ' ', 'g'
                ),
                '[^a-z0-9äöüß ]', ' ', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_operator_for_dedup(text) is
  'Normalisiert Betreiber-Strings fuer den Dubletten-Abgleich: Klammerinhalt (z. B. "(DE)", "(Business Owner at Location)") und gaengige Rechtsformen entfernt, Satzzeichen zu Leerzeichen. Ergebnis NULL bei leerem/reinem Platzhalter-String (z. B. war der gesamte Inhalt in Klammern). Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

create or replace function core.normalize_address_for_dedup(p text)
returns text
language sql
immutable
as $$
    select nullif(
        trim(both ' ' from
            regexp_replace(
                regexp_replace(lower(coalesce(p, '')), '\d{5}.*$', ' ', 'g'),
                '[^a-z0-9äöüß ]', ' ', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_address_for_dedup(text) is
  'Normalisiert Adress-Strings fuer den Dubletten-Abgleich: alles ab einer 5-stelligen PLZ abgeschnitten (haengt bei manchen Quellen noch Ort/Land an dieselbe Spalte an), Satzzeichen zu Leerzeichen. Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

create table core.charge_point_duplicate_auto_merge_log (
    id bigint generated always as identity primary key,
    tier text not null,
    keep_key text not null,
    removed_key text not null,
    distance_m numeric not null,
    removed_snapshot jsonb not null,
    merged_at timestamptz not null default now()
);

comment on table core.charge_point_duplicate_auto_merge_log is
  'Audit-Log fuer core.auto_merge_charge_point_duplicates() -- removed_snapshot ist die vollstaendige core.charge_point-Zeile des geloeschten Datensatzes (vor dem Merge) als jsonb, falls ein Automerge im Nachhinein geprueft/rueckgaengig gemacht werden muss (Loeschung selbst ist nicht automatisch rueckgaengig machbar, siehe core.merge_charge_points()).';

grant select on core.charge_point_duplicate_auto_merge_log to service_role;

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
    v_run_started timestamptz := clock_timestamp();
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
                    when operator_conflict then null
                    when addr_a is not null and addr_b is not null and addr_sim >= 0.55
                         and (pc_a is null or pc_b is null or pc_a = pc_b)
                         and (op_a is null or op_b is null or op_a = op_b or op_sim >= 0.5)
                        then 'tier1_address_operator'
                    when name_sim >= 0.6 and op_a is not null and op_b is not null
                         and (op_a = op_b or op_sim >= 0.5) and distance_m::numeric <= 80
                        then 'tier2_name_operator_80m'
                    when distance_m::numeric <= 15 and pc_a is not null and pc_a = pc_b
                         and city_a is not null and city_a = city_b
                         and addr_sim >= 0.5
                        then 'tier3_tight_geo_address'
                    else null
                end as match_tier
            from scored
        )
        select * from tiered
        where match_tier is not null
        order by key_a
    loop
        -- Frisch nachladen statt der Snapshot-Werte aus der CTE: ein
        -- vorheriger Schleifendurchlauf koennte a oder b bereits veraendert
        -- (z. B. selbst als B in einem anderen Paar) oder geloescht haben.
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

comment on function core.auto_merge_charge_point_duplicates() is
  'Fuehrt core.charge_point_duplicate-Paare automatisch zusammen, bei denen Adresse/Name/Betreiber/Abstand eindeutig auf denselben physischen Ladepunkt hindeuten (Tier 1-3, siehe Kommentar oben) -- alles andere (inkl. Betreiber-Konflikte) bleibt im manuellen Dashboard (/ladestationen/dubletten). Nutzt core.merge_charge_points() mit B (hoeher priorisierte Quelle) als Ziel und allen Feldwerten von B unveraendert. Vor dem Ausfuehren mit gutem Grund pruefen: loescht Datensaetze unwiderruflich (core.charge_point_duplicate_auto_merge_log haelt nur ein Audit-Snapshot, kein automatisches Undo). Nicht in core.refresh_charge_point_duplicates()/pg_cron eingehaengt -- bewusst nur manuell aufrufbar, siehe Nutzeranfrage vom 2026-09-21.';

grant execute on function core.auto_merge_charge_point_duplicates() to service_role;
