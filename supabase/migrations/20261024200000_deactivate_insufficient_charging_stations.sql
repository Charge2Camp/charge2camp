-- Nutzervorgabe (2026-09-23): "alle Ladestationen, die nur einen Schuko
-- stecker haben oder nur einen Anschluss mit weniger als 11kw oder gar
-- keine angabe zu Ladeleistung oder Anschluss, sollen alle deaktiviert
-- werden". Deaktivieren = is_active = false (siehe Migration
-- 20260909020000): die Station verschwindet komplett aus Liste/Suche/
-- Karte/Detailseite (404), OHNE geloescht zu werden -- reversibel, sobald
-- sich die Datenlage bessert (siehe core.
-- reactivate_sufficiently_equipped_charge_points() in der Folgemigration).
--
-- Kriterium ("unzureichend ausgestattet"), deckungsgleich mit der
-- Reaktivierungs-Regel als exaktes logisches Gegenteil (verhindert
-- Flapping zwischen den beiden Funktionen):
--   (a) core.charge_point.max_power_kw ist NULL (keine Angabe), ODER
--   (b) max_power_kw < 11 (bekannt, aber zu schwach), ODER
--   (c) gar keine core.connector-Zeile vorhanden, ODER
--   (d) ALLE vorhandenen Anschluesse sind vom Typ 'Schuko'
-- Scoping vorab gegen Produktion geprueft: 20.910 von 111.049 aktiven
-- Ladepunkten betroffen (~19%).
create or replace function core.deactivate_insufficient_charging_stations()
returns bigint
language sql
security definer
set search_path = core, public
as $$
    with updated as (
        update core.charge_point cp
        set is_active = false
        where cp.is_active = true
        and (
            cp.max_power_kw is null
            or cp.max_power_kw < 11
            or not exists (select 1 from core.connector c where c.charge_point_id = cp.id)
            or (
                exists (select 1 from core.connector c where c.charge_point_id = cp.id)
                and not exists (
                    select 1 from core.connector c
                    where c.charge_point_id = cp.id and c.standard is distinct from 'Schuko'
                )
            )
        )
        returning cp.id
    )
    select count(*) from updated;
$$;

comment on function core.deactivate_insufficient_charging_stations() is
  'Deaktiviert (is_active=false) alle aktiven Ladepunkte ohne praxistaugliche Ladeleistung: keine Anschlussdaten, keine Leistungsangabe, unter 11kW, oder ausschliesslich Schuko-Anschluesse. Nutzervorgabe 2026-09-23. Gegenstueck: core.reactivate_sufficiently_equipped_charge_points() (naechste Migration), aufgerufen bei jedem Reimport.';

grant execute on function core.deactivate_insufficient_charging_stations() to service_role;

select core.deactivate_insufficient_charging_stations();
