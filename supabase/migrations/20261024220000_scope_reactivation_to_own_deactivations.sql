-- Kritischer Fund BEIM TESTEN von core.
-- reactivate_sufficiently_equipped_charge_points() (20261024210000), vor
-- dem ersten produktiven Aufruf: es gibt bereits 35.925 aktuell inaktive
-- Ladepunkte mit max_power_kw >= 11 -- weit mehr als die 20.910, die
-- core.deactivate_insufficient_charging_stations() gerade erst deaktiviert
-- hat. Grund: is_active=false hat mehrere unabhaengige Ursachen (u. a.
-- core.deactivate_new_ocm_near_manual() -- Dublettenschutz gegen manuell
-- erfasste Stationen, oder eine bewusste Admin-Entscheidung ueber
-- setChargePointActive()) und WEDER die alte Deaktivierungs- noch die
-- Reaktivierungs-Funktion konnten diese Ursachen bisher unterscheiden. Ein
-- produktiver Aufruf der Reaktivierungs-Funktion HAETTE also faelschlich
-- tausende Dubletten-geschuetzte/administrativ deaktivierte Stationen
-- wieder sichtbar gemacht -- deshalb VOR dem ersten echten Reimport-Lauf
-- gefixt, nicht erst als Nachbesserung.
--
-- Fix: neue Spalte deactivated_by_rule markiert, WELCHE automatische Regel
-- (falls ueberhaupt eine) zuletzt is_active=false gesetzt hat.
-- Reaktivierung greift nur noch fuer Zeilen mit diesem exakten Marker --
-- alle anderen Deaktivierungsgruende (Dublettenschutz, Admin-Entscheidung)
-- bleiben unberuehrt, wie es sein muss.
alter table core.charge_point add column deactivated_by_rule text;

-- Backfill: die 20.910 Zeilen aus 20261024200000 nachtraeglich markieren
-- (die Funktion selbst existierte zum Zeitpunkt ihres Laufs noch ohne
-- diese Spalte) -- exakt dieselbe Bedingung wie damals, jetzt zusaetzlich
-- eingeschraenkt auf noch unmarkierte, weiterhin inaktive Zeilen (falls
-- zwischenzeitlich ein Admin manuell eingegriffen hat, bleibt das
-- unangetastet).
update core.charge_point cp
set deactivated_by_rule = 'insufficient_charging'
where cp.is_active = false
and cp.deactivated_by_rule is null
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
);

create or replace function core.deactivate_insufficient_charging_stations()
returns bigint
language sql
security definer
set search_path = core, public
as $$
    with updated as (
        update core.charge_point cp
        set is_active = false, deactivated_by_rule = 'insufficient_charging'
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

create or replace function core.reactivate_sufficiently_equipped_charge_points()
returns bigint
language sql
security definer
set search_path = core, public
as $$
    with updated as (
        update core.charge_point cp
        set is_active = true, deactivated_by_rule = null
        where cp.is_active = false
        and cp.deactivated_by_rule = 'insufficient_charging'
        and cp.max_power_kw is not null
        and cp.max_power_kw >= 11
        returning cp.id
    )
    select count(*) from updated;
$$;

comment on function core.deactivate_insufficient_charging_stations() is
  'Deaktiviert (is_active=false, deactivated_by_rule=''insufficient_charging'') alle aktiven Ladepunkte ohne praxistaugliche Ladeleistung: keine Anschlussdaten, keine Leistungsangabe, unter 11kW, oder ausschliesslich Schuko-Anschluesse. Nutzervorgabe 2026-09-23. Gegenstueck: core.reactivate_sufficiently_equipped_charge_points(). Der deactivated_by_rule-Marker (20261024220000) stellt sicher, dass die Reaktivierung nur Zeilen erfasst, die DIESE Regel selbst deaktiviert hat -- nicht Dublettenschutz (core.deactivate_new_ocm_near_manual) oder administrative Entscheidungen (setChargePointActive).';

comment on function core.reactivate_sufficiently_equipped_charge_points() is
  'Reaktiviert (is_active=true) deaktivierte Ladepunkte, sobald max_power_kw >= 11 -- exaktes logisches Gegenstueck zu core.deactivate_insufficient_charging_stations(). Beschraenkt auf deactivated_by_rule=''insufficient_charging'' (20261024220000) -- ruehrt Dubletten-geschuetzte oder administrativ deaktivierte Stationen NICHT an. Wird bei jedem Reimport aufgerufen: ingest/common.py import_run() (OCM/BNetzA/IRVE/RIPREE) sowie src/app/api/cron/ocm-import/route.ts. Nutzervorgabe 2026-09-23.';
