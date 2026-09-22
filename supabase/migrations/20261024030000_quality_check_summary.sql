-- Audit-Befund (2026-09-22): admin/app/(dashboard)/page.tsx ruft core.
-- run_quality_checks() nur auf, um pro check_name eine kleine Anzahl
-- ("X Auffaelligkeiten") anzuzeigen, sowie die ~10 coverage_by_country-
-- Zeilen fuer die Laender-Tabelle -- bekommt dabei aber JEDE einzelne
-- Zeile aus core.quality_check_cache zurueck (Stand heute: 28.676 Zeilen,
-- allein 23.832 davon einzelne duplicate_charge_points-Paare). Der
-- Cache-Read selbst ist schnell (Millisekunden, siehe 20261019030000),
-- aber Uebertragung/JSON-Parsing dieser Zeilenmenge bei JEDEM
-- Dashboard-Aufruf ist unnoetiger Overhead fuer eine reine Kachel-
-- Uebersicht.
--
-- Fix: dedizierte, schlanke Zusammenfassungs-Funktion -- pro Check nur
-- die Trefferanzahl, ausser bei coverage_by_country (dort werden die
-- vollen Zeilen fuer die Laender-Tabelle gebraucht, aber das sind nur
-- ~10 Zeilen). core.run_quality_checks() bleibt UNVERAENDERT bestehen
-- fuer die Stellen, die wirklich jede einzelne Zeile brauchen (z. B.
-- admin/app/(dashboard)/ladestationen/dubletten/page.tsx).
create or replace function core.quality_check_summary()
returns table(check_name text, cnt bigint, data jsonb)
language sql
stable
security definer
set search_path = core, public
as $$
    select check_name, count(*) as cnt, null::jsonb as data
    from core.quality_check_cache
    where check_name <> 'coverage_by_country'
    group by check_name
    union all
    select check_name, 1::bigint as cnt, data
    from core.quality_check_cache
    where check_name = 'coverage_by_country';
$$;

comment on function core.quality_check_summary() is
  'Schlanke Alternative zu core.run_quality_checks() fuer reine Uebersichts-Kacheln (admin/app/(dashboard)/page.tsx): pro Check nur die Anzahl, ausser coverage_by_country (dort die vollen ~10 Zeilen fuer die Laender-Tabelle) -- vermeidet die Uebertragung aller Einzelzeilen (28.676 Stand 2026-09-22, davon 23.832 einzelne Dubletten-Paare) nur um kleine Zahlen anzuzeigen. Siehe 20261024030000.';

grant execute on function core.quality_check_summary() to service_role;
