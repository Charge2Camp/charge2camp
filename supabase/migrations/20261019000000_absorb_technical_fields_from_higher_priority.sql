-- Nutzervorgabe: core.source_registry.priority (BNetzA/IRVE/RIPREE = 90 vs.
-- OCM = 40) muss sich tatsaechlich auswirken, nicht nur dokumentiert sein.
-- Bisher erzeugte jede Quelle einen komplett getrennten core.charge_point
-- (eigener external_key je Quelle, z. B. 'ocm:123' vs. 'bnetza:456') -- es
-- gab GAR KEINEN automatischen Feldvergleich zwischen OCM und einer
-- offiziellen nationalen Quelle fuer dieselbe physische Saeule, nur den rein
-- informativen Dubletten-Check im Admin-Dashboard (bewusst manuell, siehe
-- Kommentare in import_ocm.py/import_bnetza.py "Kein automatisches, stilles
-- Zusammenfuehren -- das bleibt eine Admin-Entscheidung").
--
-- Nutzeranforderung (explizit bestaetigt, inkl. Risikoabwaegung): bei
-- Anschluessen, Ladeleistung und Betriebsbereitschaft soll eine hoeher
-- priorisierte Quelle (BNetzA/IRVE/RIPREE) eine niedriger priorisierte
-- OCM-Station AUTOMATISCH ueberschreiben -- aber NUR bei einem eindeutigen
-- (genau einem) Nachbarschaftstreffer, nicht bei mehreren Kandidaten
-- (Mehrdeutigkeit bleibt weiterhin Admin-Aufgabe ueber das bestehende
-- Dubletten-Dashboard). Name/Betreiber/Adresse/Zugangsart werden NICHT
-- automatisch uebernommen (weiterhin nur ueber core.merge_charge_points im
-- Admin-Dashboard) -- nur die drei explizit genannten Felder.
--
-- Schutzregeln (in core.absorb_technical_fields() erzwungen):
--   1. Ziel-Station mit manual_override=true wird NIE automatisch
--      ueberschrieben, unabhaengig von der Quellenprioritaet -- eine
--      Admin-Korrektur ist immer staerker als jede automatische Quelle.
--   2. Nur wenn die eingehende Quelle eine ECHT hoehere priority hat als
--      die Quelle der Zielstation (core.source_registry.priority) --
--      gleiche Prioritaet (z. B. zwei nationale Quellen treffen
--      aufeinander) fuehrt NICHT zu einer automatischen Uebernahme.
alter table core.field_change_log drop constraint field_change_log_action_check;
alter table core.field_change_log add constraint field_change_log_action_check
    check (action in ('applied', 'rejected_by_manual_override', 'applied_absorb_higher_priority'));

comment on column core.field_change_log.action is
  'applied = normale Feldaktualisierung derselben Zeile; rejected_by_manual_override = Aenderung wegen manual_override verworfen; applied_absorb_higher_priority = Anschluesse/Ladeleistung/Betriebsbereitschaft von einer hoeher priorisierten Quelle automatisch in eine bestehende Station einer niedriger priorisierten Quelle uebernommen (siehe core.absorb_technical_fields(), 20261019000000).';

create or replace function core.absorb_technical_fields(
    p_target_id uuid,
    p_source text,
    p_max_power_kw numeric,
    p_connector_count int,
    p_is_operational boolean
) returns boolean
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_target core.charge_point%rowtype;
    v_target_priority smallint;
    v_incoming_priority smallint;
begin
    select * into v_target from core.charge_point where id = p_target_id for update;
    if not found then
        return false;
    end if;

    -- Admin-Korrektur schuetzt IMMER, unabhaengig von Quellenprioritaet.
    if v_target.manual_override then
        return false;
    end if;

    select priority into v_incoming_priority from core.source_registry where source_id = p_source;
    select priority into v_target_priority from core.source_registry where source_id = v_target.source;
    if v_incoming_priority is null or v_target_priority is null or v_incoming_priority <= v_target_priority then
        return false;
    end if;

    update core.charge_point set
        max_power_kw = coalesce(p_max_power_kw, max_power_kw),
        connector_count = coalesce(p_connector_count, connector_count),
        is_operational = coalesce(p_is_operational, is_operational),
        updated_at = now(),
        field_provenance = field_provenance || jsonb_build_object(
            'max_power_kw',    jsonb_build_object('source', p_source, 'updated_at', now(), 'absorbed_from_lower_priority', v_target.source),
            'connector_count', jsonb_build_object('source', p_source, 'updated_at', now(), 'absorbed_from_lower_priority', v_target.source),
            'is_operational',  jsonb_build_object('source', p_source, 'updated_at', now(), 'absorbed_from_lower_priority', v_target.source)
        )
    where id = p_target_id;

    insert into core.field_change_log (charge_point_id, field, incoming_value, incoming_source, action, existing_value)
    values
        (p_target_id, 'max_power_kw', p_max_power_kw::numeric(6,2)::text, p_source, 'applied_absorb_higher_priority', v_target.max_power_kw::numeric(6,2)::text),
        (p_target_id, 'connector_count', p_connector_count::text, p_source, 'applied_absorb_higher_priority', v_target.connector_count::text),
        (p_target_id, 'is_operational', p_is_operational::text, p_source, 'applied_absorb_higher_priority', v_target.is_operational::text);

    return true;
end;
$$;

comment on function core.absorb_technical_fields(uuid, text, numeric, int, boolean) is
  'Uebernimmt max_power_kw/connector_count/is_operational einer hoeher priorisierten Quelle in eine bestehende core.charge_point-Zeile einer niedriger priorisierten Quelle (typisch: BNetzA/IRVE/RIPREE ueberschreibt OCM). Wird vom Importer NUR bei genau EINEM eindeutigen Nachbarschaftstreffer aufgerufen (siehe ingest/common.py find_and_absorb_nearby_duplicate()) -- core.connector-Zeilen muss der Aufrufer selbst per replace_connectors() auf p_target_id nachziehen, diese Funktion aendert core.connector NICHT.';

grant execute on function core.absorb_technical_fields(uuid, text, numeric, int, boolean) to service_role;
