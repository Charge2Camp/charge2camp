-- Behebt den nachtlichen Timeout von refresh-all-quality-data (seit 2026-09-23, 11 Naechte
-- in Folge, zuletzt erfolgreich 2026-09-22) -- zwei Teile.
--
-- Ursache: Der Cron-Befehl "select core.refresh_all_quality_data()" laeuft mit einem
-- statement_timeout von 2 Minuten; ALLE fuenf Schritte (Dubletten neu berechnen, drei
-- automatische Zusammenfuehrungen, Qualitaetspruefungen) teilen sich dieses eine Limit und eine
-- Transaktion. Es scheitert im zweiten Insert von core.refresh_charge_point_duplicates()
-- (Zeile 32 im Fehlertext), dem Selbst-Join ueber exakte normalisierte Adresse + PLZ aus
-- 20261024000000 -- vom Planer quadratisch ausgefuehrt. Weil die Transaktion zurueckgerollt
-- wird, bleibt core.charge_point_duplicate auf dem Stand vom 2026-09-22, und die folgenden
-- Schritte (automatisches Zusammenfuehren, Qualitaetspruefungen) laufen gar nicht erst:
-- Dublettenbestand und Dashboard-Zahlen sind seit 11 Tagen veraltet, die ~23.000 am 27./28.09.
-- importierten Ladepunkte nie dedupliziert.
--
-- Teil 1 -- core.refresh_charge_point_duplicates(): zweiter Insert als Gleichheits-Join (Details im
-- Kommentar an der Stelle). Alles andere (TRUNCATE, erster Insert, Signatur, security definer,
-- search_path) unveraendert, gleiche Signatur: create or replace, kein DROP, kein Overload. Die
-- Produktionsfunktion wurde vor dem Schreiben mit der Repo-Version verglichen: identisch.
--
-- Teil 2 -- Zeitbudget: Der erste Insert hat das 2-Minuten-Limit schon fast aufgebraucht (der
-- Timeout traf erst den zweiten), und der Job hatte beim letzten Erfolg 1:42 Min. gebraucht --
-- mit weniger Arbeit als heute. Auch mit schnellem zweiten Insert ist deshalb offen, ob die
-- uebrigen Schritte in die Restzeit passen. Der Cron-Befehl setzt daher
-- "set statement_timeout = '20min'" vor dem Aufruf; lokal (PG 17.6, wie Produktion) geprueft,
-- dass ein SET am Anfang eines Mehrfach-Befehls das Limit fuer die folgende Anweisung
-- anhebt und nur fuer diesen Lauf gilt. cron.alter_job behaelt Job-ID und Historie. Der
-- advisory lock in refresh_all_quality_data verhindert parallele Laeufe.
--
-- Der erste Lauf nach dem Fix arbeitet einen Rueckstau ab (11 Tage Importe) und kann laenger
-- dauern als spaetere; Dauer und Erfolg stehen danach in cron.job_run_details bzw. core.cron_job_health.
-- Lokal gegen die bisherige Funktion verglichen; NICHT in Produktion angewendet/gemessen.

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
    -- vom raeumlichen Radius (siehe Migrationskommentar 20261024000000).
    --
    -- Seit 20261026240000 als Gleichheits-Join auf (normalisierte Adresse, PLZ) statt als
    -- Self-Join mit Ungleichung: Die alte Form ("join charge_point b on b.external_key >
    -- a.external_key and normalize(b.address) = normalize(a.address) and b.postcode is not
    -- distinct from a.postcode") plante je Zeile eine Bitmap-Suche, die den Adressindex per
    -- BitmapAnd mit einem Bereichsscan auf "external_key < b.external_key" (im Schnitt die
    -- Haelfte des Index, ~54.000 Eintraege) verknuepfte -- quadratisch. In Produktion auf einer
    -- Stichprobe von 170 Zeilen gemessen: 13,4 s (~79 ms/Zeile, hochgerechnet ~3 Stunden fuer
    -- alle Zeilen) -- das Statement-Timeout des Cron-Laufs (2 min) riss seit dem 2026-09-23
    -- jede Nacht. Die Normalisierung (sechs regexp_replace, ~26 us) wird jetzt einmal je Zeile
    -- berechnet; der Join laeuft ueber Gleichheit auf (na, postcode), "b.external_key >
    -- a.external_key" und die 5-km-Grenze sind nur noch Join-Filter: 11,5 s fuer den ganzen
    -- Select. Gleichwertig: a.address/a.postcode muessen nicht null sein, und ein Gleichheits-
    -- vergleich schliesst null auf der b-Seite ohnehin aus (is not distinct from == = bei
    -- nicht-null a.postcode). Auf einer Stichprobe liefern beide Formen dieselben Paare
    -- (38, identischer Hash). KEIN is_active-Filter, wie bisher.
    with n as materialized (
        select external_key, operator, geom, postcode,
               core.normalize_address_for_dedup(address) as na
        from core.charge_point
        where address is not null
          and postcode is not null
    )
    insert into core.charge_point_duplicate (key_a, key_b, operator_a, operator_b, distance_m)
    select a.external_key, b.external_key, a.operator, b.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1)
    from n a
    join n b
      on a.na = b.na
     and a.postcode = b.postcode
     and b.external_key > a.external_key
    where a.na is not null
      and st_distance(a.geom, b.geom) <= 5000
      and not exists (
          select 1 from core.charge_point_duplicate d
          where d.key_a = a.external_key and d.key_b = b.external_key
      );
end;
$$;

comment on function core.refresh_charge_point_duplicates() is
  'Befuellt core.charge_point_duplicate neu (TRUNCATE + INSERT) -- quellenuebergreifend (20261023030000) plus ein zweiter, raeumlich unbeschraenkter Kandidaten-Pfad ueber exakte normalisierte Adresse+PLZ (20261024000000; seit 20261026240000 als Gleichheits-Join auf (normalisierte Adresse, PLZ) statt quadratischem Self-Join, 11,5 s statt Stunden). Braucht bei aktueller Groesse mehrere Minuten -- nur ueber pg_cron aufrufen, nie synchron aus der App/Admin heraus.';

-- Zeitbudget des nachtlichen Jobs (nur fuer diesen Lauf, siehe oben)
do $do$
declare
    v_jobid bigint;
begin
    select jobid into v_jobid from cron.job where jobname = 'refresh-all-quality-data';
    if v_jobid is not null then
        perform cron.alter_job(
            job_id := v_jobid,
            command := $cmd$set statement_timeout = '20min'; select core.refresh_all_quality_data()$cmd$
        );
    end if;
end;
$do$;
