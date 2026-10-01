-- Fix fuer fetchCampsiteCountryOptions (src/lib/campsites.ts): die bisherige
-- Fassung las "select country_code from core.campsite limit 5000" OHNE
-- order by, distinct und is_active-Filter und dedupliziert erst in JS. Ab
-- mehr als 5.000 Campingplaetzen (EU-weiter Rollout, aktuell ~3.700) fehlt
-- ein Land im Land-Filter, sobald seine Zeilen ausserhalb der zufaelligen
-- ersten 5.000 physischen Zeilen liegen -- stillschweigend, ohne Fehler;
-- zusaetzlich konnten inaktive Campingplaetze ein Land beisteuern.
--
-- Jetzt direkt in SQL: eindeutige Laendercodes nur aktiver Campingplaetze.
-- Reine Lesefunktion (security invoker, wie core.search_charge_points), alle
-- Tabellenverweise schemaqualifiziert, daher kein "set search_path" noetig.
-- Neue Funktion -- kein bestehender Overload, kein DROP noetig.
create or replace function core.campsite_country_options()
returns setof text
language sql
stable
security invoker
as $$
    select distinct cs.country_code::text
    from core.campsite cs
    where cs.is_active and cs.country_code is not null
    order by 1
$$;

grant execute on function core.campsite_country_options() to service_role;

comment on function core.campsite_country_options() is
  'Eindeutige Laendercodes aktiver Campingplaetze fuer den Land-Filter (fetchCampsiteCountryOptions, src/lib/campsites.ts). Ersetzt "select country_code ... limit 5000" mit JS-Deduplizierung, das ab >5.000 Campingplaetzen Laender stillschweigend verlor.';
