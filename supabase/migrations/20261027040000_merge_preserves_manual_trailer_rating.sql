-- Harte Regel 1 beim Dubletten-Merge (OPTIMIERUNG.md, Befund D-5).
-- Test: ingest/test_merge_preserves_manual_rating.py.
--
-- D-5: core.merge_charge_points verwarf eine manuelle Caravan-Bewertung der
-- entfernten Zeile, sobald die ueberlebende eine automatische (nicht
-- 'unknown') hatte, und kopierte manual_override nicht mit. Gilt fuer alle
-- Auto-Merges, die diese Funktion aufrufen. Lokal reproduziert:
-- ueberlebende BNetzA-Zeile "no"/auto, entfernte Zeile "yes"/manuell ->
-- nach dem Merge blieb "no"/auto, die manuelle Bewertung war geloescht.
--
-- Funktionskoerper sonst unveraendert aus 20261024020000, gleiche Signatur
-- (kein Overload). Rechte bleiben erhalten (create or replace), d. h. nur
-- service_role nach 20261027030000.

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
    v_keep_ts enrich.trailer_suitability%rowtype;
    v_remove_ts enrich.trailer_suitability%rowtype;
    v_keep_found boolean;
    v_take_remove boolean;
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

    -- Anhaengertauglichkeit (harte Regel 1, OPTIMIERUNG.md D-5): eine
    -- manuelle Bewertung (manual_override) wird nie verworfen. Reihenfolge:
    -- 1. keep hat keine Bewertung -> remove uebernehmen
    -- 2. nur remove ist manuell -> remove gewinnt
    -- 3. beide manuell -> die zuletzt verifizierte gewinnt
    -- 4. keine manuell -> wie bisher: remove nur, wenn keep 'unknown' ist
    -- Uebernommen werden ALLE Spalten inkl. manual_override/source_type/
    -- verification_note -- vorher fehlten sie, die uebernommene manuelle
    -- Bewertung verlor dadurch ihren Schutz vor automatischen Schreibern.
    select * into v_remove_ts from enrich.trailer_suitability where charge_point_key = v_remove_key;
    if found then
        select * into v_keep_ts from enrich.trailer_suitability where charge_point_key = v_keep_key;
        v_keep_found := found;
        v_take_remove := case
            when not v_keep_found then true
            when v_remove_ts.manual_override and not v_keep_ts.manual_override then true
            when v_remove_ts.manual_override and v_keep_ts.manual_override then
                coalesce(v_remove_ts.verified_at, v_remove_ts.updated_at)
                    > coalesce(v_keep_ts.verified_at, v_keep_ts.updated_at)
            when v_keep_ts.manual_override then false
            else v_keep_ts.verdict = 'unknown'
        end;

        if v_take_remove then
            insert into enrich.trailer_suitability (
                charge_point_key, verdict, drive_through, pull_in_length_m, maneuvering_space, notes,
                origin, confirm_count, dispute_count, verified_at, verified_by, manual_override,
                source_type, verification_note, updated_at
            )
            values (
                v_keep_key, v_remove_ts.verdict, v_remove_ts.drive_through, v_remove_ts.pull_in_length_m,
                v_remove_ts.maneuvering_space, v_remove_ts.notes, v_remove_ts.origin, v_remove_ts.confirm_count,
                v_remove_ts.dispute_count, v_remove_ts.verified_at, v_remove_ts.verified_by,
                v_remove_ts.manual_override, v_remove_ts.source_type, v_remove_ts.verification_note, now()
            )
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
                manual_override = excluded.manual_override,
                source_type = excluded.source_type,
                verification_note = excluded.verification_note,
                updated_at = now();
        end if;
        delete from enrich.trailer_suitability where charge_point_key = v_remove_key;
    end if;

    delete from core.charge_point where id = p_remove_id;

    select * into v_result from core.charge_point where id = p_keep_id;
    return v_result;
end;
$$;
