-- Fortsetzung der Adress-Aehnlichkeits-Pruefung (Nutzeranfrage 2026-09-25):
-- die verbleibenden Dashboard-Paare mit hoher (aber < 100%) Aehnlichkeit
-- zeigen einen grossen, klaren Cluster (>25 Paare) franzoesischer
-- Autobahn-Raststaetten desselben Betreibers ("ENGIE Vianeo" [IRVE] vs.
-- "Engie" [OCM]): IRVE schreibt "<Name> - <Autobahncode>"
-- ("Aire de Bois Claret - A41"), OCM "<Autobahncode> - <Name>"
-- ("A41 - Aire de Bois Claret") -- dieselbe Adresse, aber core.
-- normalize_address_for_dedup() erkennt das analog zum Hausnummer-Fall
-- (20261025010000) nicht, weil der fuehrende Autobahncode ("a41", "d934",
-- "rn12", ...) mit einem BUCHSTABEN beginnt, nicht mit einer Ziffer --
-- die dortige Regel (`^\d+...`) greift hier nicht.
--
-- Fix: analoge Regel fuer einen fuehrenden Autobahn-/Strassencode
-- (1-2 Buchstaben + 1-4 Ziffern, z. B. A41, A26, D934, RN12) -- wird ans
-- Zeilenende verschoben, wenn der Rest mit einem (Orts-/Strassen-)Namen
-- beginnt. Bewusst eng gefasst (kurzer Buchstaben-Ziffern-Token) --
-- normale Strassennamen beginnen praktisch nie mit diesem Muster.
create or replace function core.normalize_address_for_dedup(p text)
returns text
language sql
immutable
as $$
    select nullif(
        trim(both ' ' from
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                regexp_replace(lower(coalesce(p, '')), '\d{5}.*$', ' ', 'g'),
                                '[^a-z0-9äöüß ]', ' ', 'g'
                            ),
                            '\mstra(ss|ß)e\M', 'str', 'g'
                        ),
                        '^((?:\d+[a-z]?\s+)*\d+[a-z]?)\s+([a-zäöüß].*)$', '\2 \1', 'g'
                    ),
                    '^([a-z]{1,2}\d{1,4})\s+([a-zäöüß].*)$', '\2 \1', 'g'
                ),
                '\s+', ' ', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_address_for_dedup(text) is
  'Normalisiert Adress-Strings fuer den Dubletten-Abgleich: alles ab einer 5-stelligen PLZ abgeschnitten, Satzzeichen zu Leerzeichen, "Straße"/"Strasse" zu "Str" kanonisiert (20261024020000), fuehrende Hausnummer(n) (20261025010000) und fuehrender Autobahn-/Strassencode wie "A41" (20261025030000) ans Zeilenende verschoben, mehrfache Leerzeichen zuletzt kollabiert (20261025020000 -- muss NACH beiden Umsortierungen laufen). Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

reindex index core.idx_cp_addr_normalized_postcode;

select * from core.merge_exact_address_duplicates(5000);
