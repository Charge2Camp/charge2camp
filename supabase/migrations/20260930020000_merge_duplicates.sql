-- Nutzerwunsch: "Moegliche Dubletten (Ladepunkte)" und "(Campingplaetze)"
-- im Admin-Dashboard (core.run_quality_checks(), Checks
-- duplicate_charge_points/duplicate_campsites) waren bisher reine Anzeige
-- ohne Aktion. Neu: core.merge_charge_points()/core.merge_campsites() --
-- der Admin waehlt pro Feld, welcher der beiden Datensaetze gewinnt, alle
-- abhaengigen Daten (Anschluesse, Bewertungen, Favoriten, Blockliste,
-- Anhaengertauglichkeit, Campingplatz-Verknuepfungen/-Merkmale) werden auf
-- den behaltenen Datensatz umgehaengt statt beim Loeschen des Duplikats
-- verloren zu gehen. Gleiche Service-Role-Bypass-Konvention wie in
-- 20260930000000_fix_admin_rpc_service_role_check.sql (Admin-Backend ruft
-- ausschliesslich ueber den Service-Role-Client auf, requireAdmin() hat den
-- Zugriff bereits vorher geprueft).
--
-- Bewusste Nicht-Abdeckung (nicht Teil dieses Merges, harmlos): verwaiste
-- enrich.research_task-Zeilen nach einem Campingplatz-Merge werden vom
-- bereits vorhandenen "orphaned_enrichment"-Qualitaetscheck erfasst statt
-- hier zusaetzlich behandelt zu werden.

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

create or replace function core.merge_campsites(
    p_keep_id uuid,
    p_remove_id uuid,
    p_name text,
    p_address text,
    p_postcode text,
    p_city text,
    p_country_code text,
    p_website text,
    p_phone text,
    p_email text,
    p_capacity int
) returns core.campsite
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_keep_key text;
    v_remove_key text;
    v_result core.campsite;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    if p_keep_id = p_remove_id then
        raise exception 'keep_id und remove_id duerfen nicht identisch sein.';
    end if;

    select external_key into v_keep_key from core.campsite where id = p_keep_id;
    select external_key into v_remove_key from core.campsite where id = p_remove_id;
    if v_keep_key is null then raise exception 'Campingplatz % (keep) nicht gefunden', p_keep_id; end if;
    if v_remove_key is null then raise exception 'Campingplatz % (remove) nicht gefunden', p_remove_id; end if;

    update core.campsite set
        name = p_name,
        address = p_address,
        postcode = p_postcode,
        city = p_city,
        country_code = p_country_code,
        website = p_website,
        phone = p_phone,
        email = p_email,
        capacity = p_capacity,
        updated_at = now()
    where id = p_keep_id;

    insert into core.campsite_amenity (campsite_id, amenity_key, value_bool, value_num, value_text, source, confidence, updated_at)
    select p_keep_id, amenity_key, value_bool, value_num, value_text, source, confidence, updated_at
    from core.campsite_amenity
    where campsite_id = p_remove_id
    on conflict (campsite_id, amenity_key) do nothing;

    insert into core.campsite_charge_link (campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m, walk_duration_s, computed_at)
    select p_keep_id, charge_point_id, relation, air_distance_m, walk_distance_m, walk_duration_s, computed_at
    from core.campsite_charge_link
    where campsite_id = p_remove_id
    on conflict (campsite_id, charge_point_id) do nothing;

    delete from public.campsite_reviews r
    where r.campsite_id = p_remove_id
      and exists (select 1 from public.campsite_reviews k where k.campsite_id = p_keep_id and k.user_id = r.user_id);
    update public.campsite_reviews set campsite_id = p_keep_id where campsite_id = p_remove_id;

    delete from public.favorites f
    where f.entity_type = 'campsite' and f.entity_id = p_remove_id
      and exists (
          select 1 from public.favorites k
          where k.entity_type = 'campsite' and k.entity_id = p_keep_id and k.user_id = f.user_id
      );
    update public.favorites set entity_id = p_keep_id
    where entity_type = 'campsite' and entity_id = p_remove_id;

    if exists (select 1 from enrich.campsite_charging where campsite_key = v_remove_key) then
        if not exists (select 1 from enrich.campsite_charging where campsite_key = v_keep_key) then
            insert into enrich.campsite_charging (
                campsite_key, has_charging, charging_type, max_power_kw, point_count,
                guests_only, pitch_charging, booking_required, price_note,
                origin, evidence_url, evidence_quote, checked_at, recheck_after, verified_at, updated_at
            )
            select v_keep_key, has_charging, charging_type, max_power_kw, point_count,
                   guests_only, pitch_charging, booking_required, price_note,
                   origin, evidence_url, evidence_quote, checked_at, recheck_after, verified_at, now()
            from enrich.campsite_charging
            where campsite_key = v_remove_key;
        end if;
        delete from enrich.campsite_charging where campsite_key = v_remove_key;
    end if;

    delete from core.campsite where id = p_remove_id;

    select * into v_result from core.campsite where id = p_keep_id;
    return v_result;
end;
$$;
