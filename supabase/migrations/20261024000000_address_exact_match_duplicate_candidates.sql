-- Nutzermeldung: zwei identische "Aral Pulse"-Stationen in Schnaittach
-- (Schwarzleite 2, exakt gleiche Adresse/PLZ/Stadt, Betreiber "Aral pulse"
-- vs. "BP Europa SE") wurden nicht zusammengefuehrt.
--
-- Ursache: core.refresh_charge_point_duplicates() (20261023030000) erzeugt
-- Kandidatenpaare NUR ueber st_dwithin(..., 100) -- die beiden Zeilen liegen
-- exakt 100.17m auseinander (BNetzA-Geocoding-Jitter fuer dieselbe Adresse),
-- also knapp AUSSERHALB des Radius. Das Paar landet nie in
-- core.charge_point_duplicate und die eigentlich dafuer gedachte
-- "tier9_exact_address"-Regel (exakte Adressgleichheit, KEIN Distanzlimit,
-- siehe 20261023030000) kommt nie zum Zug, weil die Kandidatengenerierung
-- ihr widerspricht: sie erlaubt exakte Adressmatches nur, wenn sie zufaellig
-- auch < 100m auseinanderliegen.
--
-- Fix: zusaetzlicher Kandidaten-Pfad ueber einen GUENSTIGEN Equi-Join auf
-- normalisierte Adresse + PLZ (Index unten), komplett unabhaengig vom
-- raeumlichen 100m-Radius -- passend zur bereits bestehenden
-- tier9-Merge-Regel. Kein teurer raeumlicher Self-Join (das hatte beim
-- 150m-Versuch, 20261023050000/060000, zum Timeout gefuehrt) -- ein
-- Gleichheits-Join ueber einen Funktions-Index ist bei ~234k Zeilen guenstig,
-- weil PLZ+Adresse praktisch immer nur wenige Zeilen pro Gruppe ergeben.
-- Distanz-Obergrenze 5000m bleibt als Sicherheitsnetz gegen Dateneingabefehler
-- (falsche PLZ o.ae.), nicht als eigentliches Match-Kriterium.
create index if not exists idx_cp_addr_normalized_postcode
    on core.charge_point (core.normalize_address_for_dedup(address), postcode)
    where address is not null;

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
    from core.charge_point a
    cross join lateral (
        select b.external_key, b.geom, b.operator,
               coalesce(
                 (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = b.id),
                 b.max_power_kw >= 43
               ) as b_is_fast
        from core.charge_point b
        where b.external_key > a.external_key
          and st_dwithin(a.geom, b.geom, 100)
        order by a.geom <-> b.geom
        limit 5
    ) b
    where st_dwithin(
        a.geom, b.geom,
        case when coalesce(
                    (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = a.id),
                    a.max_power_kw >= 43
                  ) or b.b_is_fast
             then 100 else 25 end
    );

    -- Zusaetzliche Kandidaten: exakte Adress- + PLZ-Gleichheit, unabhaengig
    -- vom raeumlichen Radius (siehe Migrationskommentar oben).
    insert into core.charge_point_duplicate (key_a, key_b, operator_a, operator_b, distance_m)
    select a.external_key, b.external_key, a.operator, b.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1)
    from core.charge_point a
    join core.charge_point b
      on b.external_key > a.external_key
     and core.normalize_address_for_dedup(b.address) = core.normalize_address_for_dedup(a.address)
     and b.postcode is not distinct from a.postcode
    where a.address is not null
      and core.normalize_address_for_dedup(a.address) is not null
      and a.postcode is not null
      and st_distance(a.geom, b.geom) <= 5000
      and not exists (
          select 1 from core.charge_point_duplicate d
          where d.key_a = a.external_key and d.key_b = b.external_key
      );
end;
$$;

comment on function core.refresh_charge_point_duplicates() is
  'Befuellt core.charge_point_duplicate neu (TRUNCATE + INSERT) -- quellenuebergreifend (20261023030000) plus ein zweiter, raeumlich unbeschraenkter Kandidaten-Pfad ueber exakte normalisierte Adresse+PLZ (20261024000000, faengt Faelle wie zwei BNetzA-Zeilen derselben Adresse mit >100m Geocoding-Jitter). Braucht bei aktueller Groesse mehrere Minuten -- nur ueber pg_cron aufrufen, nie synchron aus der App/Admin heraus.';
