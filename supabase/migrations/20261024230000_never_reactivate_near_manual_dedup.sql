-- Weiterer Fund beim Testen (nach 20261024220000): 315 der per
-- deactivated_by_rule='insufficient_charging' markierten Zeilen sind
-- OCM-Ladepunkte innerhalb von 40m einer manuell erfassten Station --
-- die eigentliche Ursache ihrer Inaktivitaet ist also der Dublettenschutz
-- (core.deactivate_new_ocm_near_manual(), 20260930040000), nicht (primaer)
-- ihre Ladeleistung. Ein reiner Marker-basierter Schutz (20261024220000)
-- reicht hier nicht: verbessert ein kuenftiger Reimport die gemeldete
-- Leistung dieser konkreten Dublette auf >=11kW, wuerde core.
-- reactivate_sufficiently_equipped_charge_points() sie trotzdem wieder
-- sichtbar machen -- und genau die Dublette neben der manuellen Station
-- zurueckbringen, die der Dublettenschutz verhindern soll.
--
-- Fix: zusaetzliche, vom Marker unabhaengige Sperre direkt in der
-- Reaktivierungs-Funktion -- spiegelt exakt die Bedingung aus core.
-- deactivate_new_ocm_near_manual() (Quelle 'ocm', <=40m zu einer
-- Nicht-OCM-Station). Damit ist es unerheblich, ob/wie ein Datensatz
-- markiert wurde: near-manual-Dubletten werden von dieser Funktion nie
-- angefasst.
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
        and not (
            cp.source = 'ocm'
            and exists (
                select 1 from core.charge_point other
                where other.source <> 'ocm'
                  and ST_DWithin(other.geom, cp.geom, 40)
            )
        )
        returning cp.id
    )
    select count(*) from updated;
$$;

comment on function core.reactivate_sufficiently_equipped_charge_points() is
  'Reaktiviert (is_active=true) deaktivierte Ladepunkte, sobald max_power_kw >= 11 -- exaktes logisches Gegenstueck zu core.deactivate_insufficient_charging_stations(). Beschraenkt auf deactivated_by_rule=''insufficient_charging'' (20261024220000) und ruehrt zusaetzlich NIE OCM-Ladepunkte innerhalb 40m einer manuell erfassten Station an (20261024230000, spiegelt core.deactivate_new_ocm_near_manual()) -- verhindert, dass Dublettenschutz durch eine verbesserte Leistungsangabe wieder aufgehoben wird. Wird bei jedem Reimport aufgerufen: ingest/common.py import_run() (OCM/BNetzA/IRVE/RIPREE) sowie src/app/api/cron/ocm-import/route.ts. Nutzervorgabe 2026-09-23.';
