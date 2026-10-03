-- OCM-Lizenzfilter (OPTIMIERUNG.md, Befund D-1; harte Regel 3 in CLAUDE.md:
-- keine Daten mit kommerziellen Nutzungsbeschraenkungen).
--
-- Open Charge Map lizenziert nur die eigenen Community-Beitraege unter
-- CC BY 4.0; importierte Ladepunkte behalten die Lizenz ihres
-- Datenanbieters (DataProvider.License). Provider 26 "Oplaadpalen.nl" steht
-- unter CC BY-NC-SA 3.0 (nicht kommerziell) und liefert in unseren
-- Importlaendern rund 7.675 Ladepunkte (Live-Abfrage 2026-10-03, v. a. NL).
-- Bisher filterte kein Importer nach Provider.
--
-- Ab jetzt klassifizieren beide Importer (src/lib/ocm-license.ts,
-- ingest/ocm_license.py) jeden Ladepunkt und importieren nur "allowed".
-- Diese Funktion zieht den Bestand nach: Ladepunkte, die die Quelle beim
-- aktuellen Lauf als nicht freigegeben liefert, werden deaktiviert (nicht
-- geloescht, enrich.* bleibt unberuehrt); wird ein Provider spaeter
-- freigegeben, reaktiviert der naechste Lauf genau diese Zeilen wieder.
--
-- Eigener Marker deactivated_by_rule='license_restricted' (siehe
-- 20261024220000): core.reactivate_sufficiently_equipped_charge_points()
-- reaktiviert nur 'insufficient_charging' und laesst diese Zeilen daher in
-- Ruhe. Zeilen, die schon aus ANDEREM Grund inaktiv sind (Dublettenschutz,
-- Admin-Entscheidung), werden nicht umetikettiert -- sonst wuerde eine
-- spaetere Lizenzfreigabe sie faelschlich wieder sichtbar machen.
-- 'insufficient_charging' wird dagegen ueberschrieben, damit die
-- Leistungs-Reaktivierung einen lizenzgesperrten Punkt nicht zurueckholt.
--
-- manual_override=true bleibt ausgenommen: eine Admin-Korrektur gilt als
-- manuell kuratierter Datensatz (hoechste Prioritaet, harte Regel 2); der
-- Admin entscheidet dort selbst ueber is_active.

create or replace function core.apply_ocm_license_filter(
    p_excluded_keys text[],
    p_allowed_keys text[]
)
returns table (deactivated bigint, reactivated bigint)
language sql
security definer
set search_path = core, public
as $$
    with deact as (
        update core.charge_point cp
        set is_active = false, deactivated_by_rule = 'license_restricted', updated_at = now()
        where cp.external_key = any(p_excluded_keys)
          and cp.source = 'ocm'
          and not cp.manual_override
          and (cp.is_active or cp.deactivated_by_rule = 'insufficient_charging')
        returning 1
    ),
    react as (
        update core.charge_point cp
        set is_active = true, deactivated_by_rule = null, updated_at = now()
        where cp.external_key = any(p_allowed_keys)
          and cp.source = 'ocm'
          and cp.deactivated_by_rule = 'license_restricted'
        returning 1
    )
    select (select count(*) from deact), (select count(*) from react);
$$;

-- Postgres vergibt EXECUTE standardmaessig an PUBLIC -- ohne dieses revoke
-- koennte jeder mit dem oeffentlichen Anon-Key die Funktion per PostgREST
-- aufrufen (Schema core ist exponiert).
revoke execute on function core.apply_ocm_license_filter(text[], text[]) from public, anon, authenticated;
grant execute on function core.apply_ocm_license_filter(text[], text[]) to service_role;

comment on function core.apply_ocm_license_filter(text[], text[]) is
  'Deaktiviert OCM-Ladepunkte nicht kommerziell nutzbarer Datenanbieter (deactivated_by_rule=license_restricted) und reaktiviert sie, sobald der Anbieter freigegeben ist. Aufgerufen von src/app/api/cron/ocm-import/route.ts und ingest/import_ocm.py nach jedem Lauf. Klassifizierung: src/lib/ocm-license.ts / ingest/ocm_license.py. OPTIMIERUNG.md D-1.';

-- Einmalige Bereinigung des Bestands, soweit der Provider aus den
-- Rohdaten bekannt ist (nur ingest/import_ocm.py schreibt raw.charge_point;
-- der Vercel-Cron nicht -- dessen Bestand zieht der naechste Lauf je Land
-- ueber apply_ocm_license_filter() nach, die Wochentag-Rotation deckt alle
-- Kernlaender innerhalb von 7 Tagen ab). Bewusst nur die beiden
-- recherchierten, eindeutig nicht freigegebenen Provider: 26 Oplaadpalen.nl
-- (CC BY-NC-SA 3.0) und 15 CarStations.com (IsOpenDataLicensed=false).
select core.apply_ocm_license_filter(
    coalesce((
        select array_agg('ocm:' || rc.source_id)
        from raw.charge_point rc
        where rc.source = 'ocm'
          and coalesce(rc.payload->'DataProvider'->>'ID', rc.payload->>'DataProviderID') in ('15', '26')
    ), '{}'),
    '{}'
);
