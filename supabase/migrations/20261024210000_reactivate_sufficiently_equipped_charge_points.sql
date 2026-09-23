-- Gegenstueck zu core.deactivate_insufficient_charging_stations()
-- (20261024200000). Nutzervorgabe (2026-09-23), Option "symmetrisch":
-- ein deaktivierter Ladepunkt wird bei jedem Reimport reaktiviert, sobald
-- die exakte logische Umkehrung der Deaktivierungs-Bedingung zutrifft --
-- max_power_kw >= 11, unabhaengig vom Steckertyp. Bewusst NICHT die
-- urspruenglich vom Nutzer vorgeschlagene laxere Regel ("oder bietet
-- etwas anderes als Schuko mit 3,5kW") -- das haette bei jedem Reimport
-- zu Flackern gefuehrt (z. B. ein 7kW-Type2-Anschluss waere weiterhin
-- wegen <11kW deaktiviert worden, aber wegen "nicht Schuko" sofort wieder
-- reaktiviert). Verwendet cp.max_power_kw (nicht core.connector direkt),
-- da genau dieses Feld auch die Deaktivierungs-Schwelle definiert (siehe
-- dortige Migration) -- beide Funktionen bleiben dadurch exakte
-- Gegenstuecke zueinander, kein Datensatz kann je von beiden gleichzeitig
-- erfasst werden.
create or replace function core.reactivate_sufficiently_equipped_charge_points()
returns bigint
language sql
security definer
set search_path = core, public
as $$
    with updated as (
        update core.charge_point cp
        set is_active = true
        where cp.is_active = false
        and cp.max_power_kw is not null
        and cp.max_power_kw >= 11
        returning cp.id
    )
    select count(*) from updated;
$$;

comment on function core.reactivate_sufficiently_equipped_charge_points() is
  'Reaktiviert (is_active=true) deaktivierte Ladepunkte, sobald max_power_kw >= 11 -- exaktes logisches Gegenstueck zu core.deactivate_insufficient_charging_stations(). Wird bei jedem Reimport aufgerufen: ingest/common.py import_run() (OCM/BNetzA/IRVE/RIPREE) sowie src/app/api/cron/ocm-import/route.ts. Nutzervorgabe 2026-09-23.';

grant execute on function core.reactivate_sufficiently_equipped_charge_points() to service_role;

-- Reaktivierungs-Abfrage filtert auf WHERE NOT is_active -- alle
-- bisherigen core.charge_point-Indizes decken nur is_active=true ab
-- (siehe 20261024160000ff, admin-Listen-Timeouts). Ohne diesen Index
-- waere jeder Reimport-Lauf ein Sequential Scan ueber inzwischen 47.779
-- inaktive Zeilen -- bei aktuellem Datenvolumen unkritisch, aber gezielt
-- indiziert, damit das mit wachsendem Datenbestand nicht zum selben
-- Timeout-Muster wie bei den Admin-Listen-Abfragen wird.
create index idx_cp_inactive_power on core.charge_point (max_power_kw)
    where not is_active and max_power_kw is not null;
