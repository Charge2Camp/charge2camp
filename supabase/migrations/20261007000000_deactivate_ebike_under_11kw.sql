-- Nutzerwunsch: Ladepunkte, die unter 11 kW Ladeleistung haben UND deren
-- Anbieter- oder Stationsname "E Bike"/"E-Bike" enthaelt, sind fuer
-- Charge2Camp (Gespann-/E-Auto-Laden) irrelevant und sollen nicht mehr
-- angezeigt werden. Gleiches Deaktivierungsmuster wie
-- core.deactivate_new_ocm_near_manual() (20260930040000): is_active = false
-- statt Loeschen, core.charge_point_geo & alle Views filtern bereits auf
-- is_active (20260909020000_campsite_charge_point_active_flag.sql).
update core.charge_point
set is_active = false,
    updated_at = now()
where is_active = true
  and max_power_kw is not null
  and max_power_kw < 11
  and (
      operator ~* 'e[- ]?bike'
      or name ~* 'e[- ]?bike'
  );
