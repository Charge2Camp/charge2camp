-- Nutzermeldung (2026-09-22, zwei konkrete Faelle):
--   1) Raubling, Kufsteiner Straße 116: bnetza:1119483 ("Energie Südbayern
--      GmbH") vs. manual:ded4e1ca-... ("Energie Südbayern", manual_override
--      =true) -- 58m auseinander, nicht zusammengefuehrt.
--   2) Rosenheim, Kufsteiner Straße/Str. 57: bnetza:1129882 ("Aral Pulse" /
--      "BP Europa SE") vs. manual:26d18816-... ("Aral-Ladestation" /
--      "Aral pulse", manual_override=true) -- 46m auseinander, nicht
--      zusammengefuehrt.
--
-- Ursache 1 (Adressnormalisierung): core.normalize_address_for_dedup()
-- macht aus Satzzeichen Leerzeichen, kennt aber NICHT, dass "Straße",
-- "Strasse" und "Str." dieselbe Bedeutung haben -- "Kufsteiner Straße 116"
-- und "Kufsteiner Str. 116" normalisieren bisher zu unterschiedlichen
-- Strings ("kufsteiner straße 116" vs. "kufsteiner str 116") und gelten
-- damit NICHT als "exakt gleiche Adresse" (tier9_exact_address). Fix:
-- "straße"/"strasse" wird zu "str" kanonisiert (wortgrenzenbasiert, analog
-- zum bereits bestehenden Rechtsform-Ersatz in
-- normalize_operator_for_dedup, 20261021000000), zusaetzlich mehrfache
-- Leerzeichen kollabiert. core.idx_cp_addr_normalized_postcode
-- (20261024000000) wird per REINDEX aktualisiert -- Postgres verfolgt bei
-- IMMUTABLE-Funktionen keine Aenderungen am Funktionskoerper, ein
-- funktionaler Index wuerde sonst weiter die alten (falschen) Werte
-- enthalten.
--
-- Ursache 2 (manual_override blockiert JEDEN Automerge, siehe
-- 20261023000000): richtig als genereller Schutz vor dem 1.201-Zeilen-
-- Vorfall, aber zu grob fuer genau diesen Fall -- Nutzervorgabe: bei
-- eindeutigem Adress-/Namensmatch MIT der Bundesnetzagentur (Tier 1
-- "Adresse+Betreiber" oder Tier 9 "exakte Adresse", siehe
-- core.auto_merge_charge_point_duplicates_batch()) soll die
-- Bundesnetzagentur-Zeile trotzdem gewinnen ("BNetzA bleibt hier Prio1"),
-- ausdruecklich ABWEICHEND von core.source_registry.priority (dort steht
-- admin_manual mit 100 sogar VOR bundesnetzagentur mit 90 -- diese
-- generelle Prioritaet bleibt fuer alle anderen Zwecke unveraendert, siehe
-- core.absorb_technical_fields()). Alle abhaengigen Daten (Bewertungen,
-- Anhaengertauglichkeit/enrich.trailer_suitability, Favoriten, Blockliste)
-- werden von core.merge_charge_points() bereits unabhaengig von Quelle/
-- manual_override auf die ueberlebende Zeile uebertragen (siehe
-- 20260930020000) -- bleiben also in jedem Fall erhalten.
--
-- Bewusst eng gefasst (kein genereller Bruch der manual_override-Regel):
-- NUR Paare mit GENAU einer Bundesnetzagentur-Seite UND GENAU einer
-- manual_override-Seite (beide manual_override=true bleibt weiterhin
-- ausschliesslich manuelles Review -- zwei sich widersprechende
-- Admin-Korrekturen kann kein Automatismus sinnvoll entscheiden) UND nur
-- Tier 1/Tier 9 (die beiden staerksten, am wenigsten fehleranfaelligen
-- Regeln). Alle anderen Kombinationen (z. B. OCM vs. admin_manual, loses
-- Tier 6/7/8) bleiben weiterhin ausschliesslich im manuellen Dashboard.

create or replace function core.normalize_address_for_dedup(p text)
returns text
language sql
immutable
as $$
    select nullif(
        trim(both ' ' from
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(lower(coalesce(p, '')), '\d{5}.*$', ' ', 'g'),
                        '[^a-z0-9äöüß ]', ' ', 'g'
                    ),
                    '\mstra(ss|ß)e\M', 'str', 'g'
                ),
                '\s+', ' ', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_address_for_dedup(text) is
  'Normalisiert Adress-Strings fuer den Dubletten-Abgleich: alles ab einer 5-stelligen PLZ abgeschnitten, Satzzeichen zu Leerzeichen, "Straße"/"Strasse" zu "Str" kanonisiert (20261024020000 -- sonst gelten "Musterstraße 1" und "Musterstr. 1" faelschlich als verschiedene Adressen), mehrfache Leerzeichen kollabiert. Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

-- Funktionaler Index (20261024000000) auf denselben Funktionsnamen neu
-- aufbauen -- IMMUTABLE-Funktionsaenderungen werden von Postgres nicht
-- automatisch nachgezogen.
reindex index core.idx_cp_addr_normalized_postcode;

-- Beim ersten Testlauf des unten neu hinzugefuegten Automerges gefundener
-- echter Bug in core.merge_charge_points() (20260930020000): die Funktion
-- haengt Bewertungen/Anschluesse/Favoriten/Blockliste/Anhaengertauglichkeit
-- der entfernten Zeile bereits um, VERGISST aber enrich.
-- missing_station_report.created_charge_point_id (Nutzer-Meldung "hier
-- fehlt eine Ladesaeule", die zu genau dieser Zeile gefuehrt hat, siehe
-- 20261003000000) -- ein Merge einer aus so einer Meldung entstandenen Zeile
-- schlug deshalb mit einem Fremdschluessel-Fehler fehl statt zu verwaeisen.
-- Ergaenzt um dieselbe "auf die ueberlebende Zeile umhaengen"-Reassignment
-- wie fuer enrich.trailer_report.
create or replace function core.merge_charge_points(
    p_keep_id uuid,
    p_remove_id uuid,
    p_name text,
    p_operator text,
    p_network text,
    p_address text,
    p_postcode text,
    p_city text,
    p_country_code text,
    p_access_type text,
    p_is_operational boolean
) returns core.charge_point
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_keep_key text;
    v_remove_key text;
    v_result core.charge_point;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    if p_keep_id = p_remove_id then
        raise exception 'keep_id und remove_id duerfen nicht identisch sein.';
    end if;

    select external_key into v_keep_key from core.charge_point where id = p_keep_id;
    select external_key into v_remove_key from core.charge_point where id = p_remove_id;
    if v_keep_key is null then raise exception 'Ladepunkt % (keep) nicht gefunden', p_keep_id; end if;
    if v_remove_key is null then raise exception 'Ladepunkt % (remove) nicht gefunden', p_remove_id; end if;

    update core.charge_point set
        name = p_name,
        operator = p_operator,
        network = p_network,
        address = p_address,
        postcode = p_postcode,
        city = p_city,
        country_code = p_country_code,
        access_type = p_access_type,
        is_operational = p_is_operational,
        updated_at = now()
    where id = p_keep_id;

    -- Anschluesse des Duplikats uebernehmen, dann exakte Dopplungen
    -- zusammenfassen (Menge addiert) statt sie doppelt stehen zu lassen.
    update core.connector set charge_point_id = p_keep_id where charge_point_id = p_remove_id;

    with grouped as (
        select charge_point_id, standard, power_kw, current_type,
               sum(quantity) as total_quantity,
               min(id) as keep_connector_id
        from core.connector
        where charge_point_id = p_keep_id
        group by charge_point_id, standard, power_kw, current_type
        having count(*) > 1
    )
    update core.connector c set quantity = g.total_quantity
    from grouped g
    where c.id = g.keep_connector_id;

    delete from core.connector c
    using core.connector c2
    where c.charge_point_id = p_keep_id
      and c2.charge_point_id = p_keep_id
      and c.id > c2.id
      and c.standard is not distinct from c2.standard
      and c.power_kw is not distinct from c2.power_kw
      and c.current_type is not distinct from c2.current_type;

    update core.charge_point cp set
        max_power_kw = (select max(power_kw) from core.connector where charge_point_id = p_keep_id),
        connector_count = (select coalesce(sum(quantity), 0) from core.connector where charge_point_id = p_keep_id)
    where cp.id = p_keep_id;

    -- Campingplatz-Verknuepfungen uebernehmen (Duplikat-Verknuepfung
    -- verwirft sich selbst per ON CONFLICT, wenn der Campingplatz beide
    -- schon kennt).
    insert into core.campsite_charge_link (campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m, walk_duration_s, computed_at)
    select campsite_id, p_keep_id, relation, air_distance_m, walk_distance_m, walk_duration_s, computed_at
    from core.campsite_charge_link
    where charge_point_id = p_remove_id
    on conflict (campsite_id, charge_point_id) do nothing;

    update public.charging_reviews set charging_station_id = p_keep_id where charging_station_id = p_remove_id;

    delete from public.favorites f
    where f.entity_type = 'charging_station' and f.entity_id = p_remove_id
      and exists (
          select 1 from public.favorites k
          where k.entity_type = 'charging_station' and k.entity_id = p_keep_id and k.user_id = f.user_id
      );
    update public.favorites set entity_id = p_keep_id
    where entity_type = 'charging_station' and entity_id = p_remove_id;

    delete from public.blocked_charging_stations b
    where b.charging_station_id = p_remove_id
      and exists (
          select 1 from public.blocked_charging_stations k
          where k.charging_station_id = p_keep_id and k.user_id = b.user_id
      );
    update public.blocked_charging_stations set charging_station_id = p_keep_id
    where charging_station_id = p_remove_id;

    update enrich.trailer_report set charge_point_key = v_keep_key where charge_point_key = v_remove_key;

    -- Nutzer-Meldung ("hier fehlt eine Ladesaeule"), aus der p_remove_id
    -- einst als neue Zeile entstanden ist -- bleibt sonst als Fremd-
    -- schluessel auf eine gleich geloeschte Zeile stehen (20261024020000).
    update enrich.missing_station_report set created_charge_point_id = p_keep_id
    where created_charge_point_id = p_remove_id;

    if exists (select 1 from enrich.trailer_suitability where charge_point_key = v_remove_key) then
        if not exists (select 1 from enrich.trailer_suitability where charge_point_key = v_keep_key and verdict <> 'unknown') then
            insert into enrich.trailer_suitability (
                charge_point_key, verdict, drive_through, pull_in_length_m, maneuvering_space, notes,
                origin, confirm_count, dispute_count, verified_at, verified_by, updated_at
            )
            select v_keep_key, verdict, drive_through, pull_in_length_m, maneuvering_space, notes,
                   origin, confirm_count, dispute_count, verified_at, verified_by, now()
            from enrich.trailer_suitability
            where charge_point_key = v_remove_key
            on conflict (charge_point_key) do update set
                verdict = excluded.verdict,
                drive_through = excluded.drive_through,
                pull_in_length_m = excluded.pull_in_length_m,
                maneuvering_space = excluded.maneuvering_space,
                notes = excluded.notes,
                origin = excluded.origin,
                confirm_count = excluded.confirm_count,
                dispute_count = excluded.dispute_count,
                verified_at = excluded.verified_at,
                verified_by = excluded.verified_by,
                updated_at = now();
        end if;
        delete from enrich.trailer_suitability where charge_point_key = v_remove_key;
    end if;

    delete from core.charge_point where id = p_remove_id;

    select * into v_result from core.charge_point where id = p_keep_id;
    return v_result;
end;
$$;

create or replace function core.auto_merge_bnetza_over_manual_duplicates(p_limit int default 500)
returns table(tier text, merged_count bigint)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_pair record;
    v_bnetza core.charge_point%rowtype;
    v_other core.charge_point%rowtype;
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
                a.source as source_a, b.source as source_b,
                a.name as name_a, b.name as name_b,
                a.manual_override as override_a, b.manual_override as override_b,
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
            -- genau eine Seite Bundesnetzagentur, genau eine Seite
            -- manual_override (siehe Migrationskommentar).
            and (a.source = 'bundesnetzagentur') <> (b.source = 'bundesnetzagentur')
            and a.manual_override <> b.manual_override
        ),
        scored as (
            select *,
                case when op_a is not null and op_b is not null then similarity(op_a, op_b) end as op_sim,
                case when addr_a is not null and addr_b is not null then similarity(addr_a, addr_b) end as addr_sim,
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
        select * into v_bnetza from core.charge_point where id = (case when v_pair.source_a = 'bundesnetzagentur' then v_pair.a_id else v_pair.b_id end);
        select * into v_other from core.charge_point where id = (case when v_pair.source_a = 'bundesnetzagentur' then v_pair.b_id else v_pair.a_id end);
        if not found or v_bnetza.id is null or v_other.id is null then
            continue;
        end if;
        -- Doppelte Absicherung (Status koennte sich seit der
        -- Kandidaten-Auswahl geaendert haben, z. B. paralleler Admin-Edit).
        if v_bnetza.source <> 'bundesnetzagentur' or not v_other.manual_override or v_bnetza.manual_override then
            continue;
        end if;

        insert into core.charge_point_duplicate_auto_merge_log (tier, keep_key, removed_key, distance_m, removed_snapshot)
        values (v_pair.match_tier, v_bnetza.external_key, v_other.external_key, v_pair.distance_m, to_jsonb(v_other));

        -- BNetzA-Feldwerte bleiben unveraendert (Nutzervorgabe "BNetzA
        -- bleibt hier Prio1") -- core.merge_charge_points() haengt
        -- Bewertungen/Anhaengertauglichkeit/Favoriten/Blockliste der
        -- entfernten (manual_override-)Zeile unabhaengig davon auf die
        -- ueberlebende BNetzA-Zeile um.
        perform core.merge_charge_points(
            p_keep_id => v_bnetza.id,
            p_remove_id => v_other.id,
            p_name => v_bnetza.name,
            p_operator => v_bnetza.operator,
            p_network => v_bnetza.network,
            p_address => v_bnetza.address,
            p_postcode => v_bnetza.postcode,
            p_city => v_bnetza.city,
            p_country_code => v_bnetza.country_code,
            p_access_type => v_bnetza.access_type,
            p_is_operational => v_bnetza.is_operational
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

comment on function core.auto_merge_bnetza_over_manual_duplicates(int) is
  'Eng gefasste Ergaenzung zu core.auto_merge_charge_point_duplicates_batch() (die JEDES Paar mit manual_override-Seite generell ausschliesst, 20261023000000): fuer Paare mit GENAU einer Bundesnetzagentur-Seite und GENAU einer manual_override-Seite, die Tier 1 (Adresse+Betreiber) oder Tier 9 (exakte Adresse) matchen, gewinnt die Bundesnetzagentur-Zeile (Nutzervorgabe 2026-09-22, "BNetzA bleibt hier Prio1") -- abhaengige Daten (Bewertungen/Anhaengertauglichkeit/Favoriten/Blockliste) der entfernten Zeile werden trotzdem von core.merge_charge_points() erhalten. Beide manual_override=true bleibt weiterhin manuelles Review.';

grant execute on function core.auto_merge_bnetza_over_manual_duplicates(int) to service_role;

-- In den naechtlichen Qualitaets-Refresh einhaengen (core.
-- refresh_all_quality_data(), 20261023070000), damit kuenftige Faelle wie
-- die beiden oben genannten nicht wieder liegen bleiben, bis sie jemandem
-- zufaellig auffallen.
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
    perform core.auto_merge_bnetza_over_manual_duplicates(500);
    perform core.refresh_quality_checks();
end;
$$;

-- Einmaliger Nachlauf ueber den BESTEHENDEN Datenbestand (Nutzervorgabe
-- "dies muss auf alle Datensaetze geprueft werden") -- 1.019 manual_override-
-- Zeilen insgesamt (Stand 2026-09-22), p_limit weit darueber gesetzt, damit
-- alle betroffenen Paare in einem Lauf erledigt werden.
select core.auto_merge_bnetza_over_manual_duplicates(5000);
