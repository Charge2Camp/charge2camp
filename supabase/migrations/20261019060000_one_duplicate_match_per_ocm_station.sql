-- Nutzerfeedback: dieselbe OCM-Station erschien im Dubletten-Dashboard bis
-- zu 4-5 mal, jedes Mal gegen eine ANDERE BNetzA-Zeile, aber mit exakt
-- derselben Distanz (z.B. ocm:62793 <-> bnetza:1164790/791/792/793, alle
-- 81,5m). Ursache: BNetzA registriert offenbar eine Zeile pro einzelnem
-- Ladepunkt/Anschluss, OCM dagegen eine Zeile pro physischer Station --
-- ein Hub mit 4 Anschluessen erzeugt bei BNetzA 4 Zeilen, die alle gegen
-- dieselbe OCM-Station als "Dublette" matchen (core.refresh_charge_point_
-- duplicates(), 20261019020000, LIMIT 15 in der LATERAL-Subquery).
--
-- Nutzerentscheidung: nur noch der naechstgelegene Treffer pro OCM-Station
-- (LIMIT 1 statt 15) -- die anderen Anschluesse desselben Hubs sind keine
-- Dublette, sondern separate, echte Ladepunkte und bleiben unangetastet in
-- core.charge_point (werden nur nicht mehr als Dubletten-Kandidat
-- vorgeschlagen, verlieren aber keine Daten -- core.merge_charge_points()
-- betrifft ausschliesslich das explizit gewaehlte Paar).
create or replace function core.refresh_charge_point_duplicates()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    truncate table core.charge_point_duplicate;

    insert into core.charge_point_duplicate (key_a, key_b, operator_a, operator_b, distance_m)
    select a.external_key, b.external_key, a.operator, b.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1)
    from (select * from core.charge_point where source = 'ocm') a
    cross join lateral (
        select b.external_key, b.geom, b.operator,
               coalesce(
                 (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = b.id),
                 b.max_power_kw >= 43
               ) as b_is_fast
        from core.charge_point b
        where b.source <> a.source
          and st_dwithin(a.geom, b.geom, 100)
        order by a.geom <-> b.geom
        limit 1
    ) b
    where st_dwithin(
        a.geom, b.geom,
        case when coalesce(
                    (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = a.id),
                    a.max_power_kw >= 43
                  ) or b.b_is_fast
             then 100 else 25 end
    );
end;
$$;
