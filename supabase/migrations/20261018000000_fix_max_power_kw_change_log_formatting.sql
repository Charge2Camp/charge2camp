-- Bug gefunden beim Testen von ingest/import_ripree.py (Spanien): ein
-- zweiter, inhaltlich IDENTISCHER Import derselben Datei loggte
-- max_power_kw bei jeder betroffenen Station faelschlich als 'applied'
-- (geaendert) in core.field_change_log, obwohl sich der Wert nie
-- veraendert hat -- z. B. incoming='7.0', existing='7.0', trotzdem als
-- Aenderung erkannt.
--
-- Ursache: core.charge_point.max_power_kw ist numeric(6,2) (immer 2
-- Nachkommastellen), aber v_max_power_kw in core.upsert_charge_point() ist
-- als unskaliertes numeric deklariert und wird aus dem JSON-Payload ueber
-- ein ebenfalls unskaliertes ::numeric gecastet. ::text auf einem
-- unskalierten numeric behaelt die Nachkommastellen des Quellwerts (JSON
-- "7.0" -> numeric 7.0 -> text '7.0'), waehrend v_existing.max_power_kw
-- (direkt aus der numeric(6,2)-Spalte gelesen) IMMER als '7.00' formatiert.
-- Die vorherige "Ueber numeric gecastet statt reinem Text-Vergleich"-Fix
-- (siehe Kommentar in 20261012000000) hat nur den Vergleich INNERHALB
-- desselben Aufrufs (incoming vs. final, beide gleich berechnet) repariert,
-- nicht den Vergleich ueber zwei Aufrufe hinweg (final vs. v_existing).
--
-- Reiner Logging-Bug, keine Datenkorruption: der eigentliche
-- UPDATE-Befehl schreibt v_max_power_kw ohnehin in eine numeric(6,2)-Spalte,
-- Postgres rundet/skaliert beim Zuweisen automatisch korrekt. Betroffen ist
-- nur core.field_change_log (unnoetige 'applied'-Eintraege bei jedem
-- Reimport) -- fuer die verbindliche Audit-Trail-Anforderung
-- (Auftragsdokument Abschnitt 15) aber trotzdem ein echter Fehler.
--
-- Fix: alle drei Vergleichspunkte (incoming, final, v_existing) explizit
-- auf ::numeric(6,2) skaliert, bevor sie zu ::text werden -- identische
-- Formatierung ueberall.
create or replace function core.upsert_charge_point(
    p_payload jsonb,
    p_source text
) returns table(id uuid, manual_override boolean, is_new boolean)
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_external_key text := p_payload->>'external_key';
    v_lon double precision := nullif(p_payload->>'lon', '')::double precision;
    v_lat double precision := nullif(p_payload->>'lat', '')::double precision;
    v_incoming_geom geography := ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326)::geography;
    v_existing core.charge_point%rowtype;
    v_id uuid;
    v_manual boolean;
    v_incoming_is_operational boolean := (p_payload->>'is_operational')::boolean;
    v_name text; v_operator text; v_geom geography; v_address text; v_city text;
    v_country_code text; v_access_type text; v_max_power_kw numeric; v_connector_count int;
    v_is_operational boolean; v_network text; v_postcode text;
begin
    if not exists (select 1 from core.source_registry where source_id = p_source) then
        raise exception 'Unbekannte Quelle "%" -- core.source_registry benoetigt vorab einen Eintrag.', p_source;
    end if;
    if v_lon is null or v_lat is null then
        raise exception 'core.upsert_charge_point: lon/lat fehlen fuer external_key %', v_external_key;
    end if;

    select * into v_existing from core.charge_point where external_key = v_external_key for update;

    if not found then
        insert into core.charge_point (
            external_key, name, operator, network, geom, address, postcode, city,
            country_code, access_type, is_operational, max_power_kw, connector_count,
            source, source_updated_at, last_seen_at, updated_at, is_active, field_provenance
        ) values (
            v_external_key,
            p_payload->>'name', p_payload->>'operator', p_payload->>'network', v_incoming_geom,
            p_payload->>'address', p_payload->>'postcode', p_payload->>'city',
            p_payload->>'country_code', p_payload->>'access_type',
            coalesce(v_incoming_is_operational, true),
            nullif(p_payload->>'max_power_kw', '')::numeric,
            nullif(p_payload->>'connector_count', '')::int,
            p_source, nullif(p_payload->>'source_updated_at', '')::timestamptz, now(), now(),
            coalesce((p_payload->>'initial_is_active')::boolean, true),
            (
                select jsonb_object_agg(f, jsonb_build_object('source', p_source, 'updated_at', now()))
                from unnest(array[
                    'name','operator','network','geom','address','postcode','city',
                    'country_code','access_type','is_operational','max_power_kw','connector_count'
                ]) f
            )
        )
        returning core.charge_point.id into v_id;

        return query select v_id, false, true;
        return;
    end if;

    v_id := v_existing.id;
    v_manual := v_existing.manual_override;

    v_name           := case when v_manual then v_existing.name else p_payload->>'name' end;
    v_operator       := case when v_manual then v_existing.operator else p_payload->>'operator' end;
    v_geom           := case when v_manual then v_existing.geom else v_incoming_geom end;
    v_address        := case when v_manual then v_existing.address else p_payload->>'address' end;
    v_city           := case when v_manual then v_existing.city else p_payload->>'city' end;
    v_country_code   := case when v_manual then v_existing.country_code else p_payload->>'country_code' end;
    v_access_type    := case when v_manual then v_existing.access_type else p_payload->>'access_type' end;
    v_max_power_kw   := case when v_manual then v_existing.max_power_kw else nullif(p_payload->>'max_power_kw', '')::numeric end;
    v_connector_count := case when v_manual then v_existing.connector_count else nullif(p_payload->>'connector_count', '')::int end;
    v_is_operational := case
        when v_incoming_is_operational is false then false
        when v_manual then v_existing.is_operational
        else coalesce(v_incoming_is_operational, true)
    end;
    v_network  := p_payload->>'network';
    v_postcode := p_payload->>'postcode';

    update core.charge_point set
        name = v_name, operator = v_operator, network = v_network, geom = v_geom,
        address = v_address, postcode = v_postcode, city = v_city,
        country_code = v_country_code, access_type = v_access_type,
        is_operational = v_is_operational, max_power_kw = v_max_power_kw,
        connector_count = v_connector_count,
        source_updated_at = nullif(p_payload->>'source_updated_at', '')::timestamptz,
        last_seen_at = now(), updated_at = now(),
        field_provenance = field_provenance || jsonb_strip_nulls(jsonb_build_object(
            'name',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'operator',        case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'geom',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'address',         case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'city',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'country_code',    case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'access_type',     case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'max_power_kw',    case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'connector_count', case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'is_operational',  jsonb_build_object('source', p_source, 'updated_at', now()),
            'network',         jsonb_build_object('source', p_source, 'updated_at', now()),
            'postcode',        jsonb_build_object('source', p_source, 'updated_at', now())
        ))
    where core.charge_point.id = v_id;

    with changes(field, incoming, final) as (
        values
            ('name', p_payload->>'name', v_name),
            ('operator', p_payload->>'operator', v_operator),
            ('address', p_payload->>'address', v_address),
            ('city', p_payload->>'city', v_city),
            ('country_code', p_payload->>'country_code', v_country_code),
            ('access_type', p_payload->>'access_type', v_access_type),
            -- ::numeric(6,2) statt unskaliertem ::numeric -- siehe
            -- Migrationskommentar oben. Muss mit der tatsaechlichen
            -- Spaltenskalierung von core.charge_point.max_power_kw
            -- uebereinstimmen, sonst driften incoming/final/v_existing
            -- wieder auseinander.
            ('max_power_kw', (nullif(p_payload->>'max_power_kw', '')::numeric(6,2))::text, v_max_power_kw::numeric(6,2)::text),
            ('connector_count', (nullif(p_payload->>'connector_count', '')::int)::text, v_connector_count::text),
            ('is_operational', v_incoming_is_operational::text, v_is_operational::text)
    )
    insert into core.field_change_log (charge_point_id, field, incoming_value, incoming_source, action, existing_value)
    select v_id, field, incoming, p_source,
           case when incoming is distinct from final then 'rejected_by_manual_override' else 'applied' end,
           final
    from changes
    where incoming is distinct from final
       or (final is distinct from (
           case field
               when 'name' then v_existing.name
               when 'operator' then v_existing.operator
               when 'address' then v_existing.address
               when 'city' then v_existing.city
               when 'country_code' then v_existing.country_code
               when 'access_type' then v_existing.access_type
               when 'max_power_kw' then v_existing.max_power_kw::numeric(6,2)::text
               when 'connector_count' then v_existing.connector_count::text
               when 'is_operational' then v_existing.is_operational::text
           end
       ));

    return query select v_id, v_manual, false;
end;
$$;
