-- Nutzerwunsch: core.charge_point.operator enthaelt bei OCM drei
-- Platzhalter-Werte, die KEINE echten Anbieter sind, sondern nur den
-- Besitzertyp der Saeule beschreiben ("privat"/"unbekannt"):
--   "(Business Owner at Location)"   5657 Stationen
--   "(Unknown Operator)"             3397 Stationen
--   "(Private Residence/Individual)"  263 Stationen
-- (Zahlen Stand Produktions-DB, siehe Recherche in dieser Session.) Fuer
-- jemanden, der gezielt "nur bei IONITY laden" moechte, ist das keine
-- relevante Filteroption und wuerde die Ladeanbieter-Auswahl mit fast
-- 6000 Treffern fuer einen nichtssagenden Eintrag verstopfen.
--
-- Alle drei bestehen komplett aus einer runden Klammer ohne vorangestellten
-- Firmennamen -- ein generisches Muster (statt einer festen Werteliste),
-- das auch kuenftige, noch unbekannte OCM-Platzhalter derselben Form
-- automatisch mit ausschliesst, ohne dass echte Anbieter wie
-- "EnBW (D)"/"Shell Recharge Solutions (DE)" betroffen sind (die haben
-- immer einen Namen VOR der Klammer).

create or replace function core.charge_point_operator_options(p_min_stations int default 5)
returns table (
    operator text,
    station_count bigint
)
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select cp.operator, count(*) as station_count
    from core.charge_point cp
    where cp.operator is not null
      and cp.is_active = true
      and cp.operator !~ '^\(.*\)$'
    group by cp.operator
    having count(*) >= p_min_stations
    order by cp.operator;
end;
$$;
