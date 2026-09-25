-- Bugfix zu 20261025010000: die dort neu hinzugefuegte Hausnummer-
-- Umsortierung lief als AEUSSERSTER regexp_replace, also NACH dem
-- bestehenden Leerzeichen-Kollabieren-Schritt -- wenn der umsortierte Rest
-- (Gruppe 2, z. B. "grünberger str ") bereits mit einem Leerzeichen endete
-- (uebrig vom entfernten Satzzeichen, z. B. "Str." -> "str "), erzeugte die
-- Ersetzung "\2 \1" ein DOPPELTES Leerzeichen ("grünberger str  152"), das
-- vom (davor gelaufenen) Kollabieren-Schritt nicht mehr erfasst wurde.
--
-- Betraf konkret ~10 Kandidatenpaare mit exakt identischer Adresse
-- (ueberwiegend franzoesische IRVE-Adressen wie "26 Rue Gay Lussac" vs.
-- "Rue Gay-Lussac 26"), die dadurch trotz Fix aus 20261025010000 WEITERHIN
-- als "verschieden" normalisiert wurden ("rue gay lussac 26" vs. "rue gay
-- lussac  26") -- in core.quality_check_cache an addr_sim = 1.00 (Trigram-
-- Aehnlichkeit ist leerzeichen-unempfindlicher) erkennbar.
--
-- Fix: Reihenfolge tauschen -- Hausnummer-Umsortierung laeuft jetzt VOR
-- dem Leerzeichen-Kollabieren, das raeumt danach jedes durch die Umsortierung
-- entstandene doppelte Leerzeichen zuverlaessig auf.
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
                            regexp_replace(lower(coalesce(p, '')), '\d{5}.*$', ' ', 'g'),
                            '[^a-z0-9äöüß ]', ' ', 'g'
                        ),
                        '\mstra(ss|ß)e\M', 'str', 'g'
                    ),
                    '^((?:\d+[a-z]?\s+)*\d+[a-z]?)\s+([a-zäöüß].*)$', '\2 \1', 'g'
                ),
                '\s+', ' ', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_address_for_dedup(text) is
  'Normalisiert Adress-Strings fuer den Dubletten-Abgleich: alles ab einer 5-stelligen PLZ abgeschnitten, Satzzeichen zu Leerzeichen, "Straße"/"Strasse" zu "Str" kanonisiert (20261024020000), fuehrende Hausnummer(n) ans Zeilenende verschoben (20261025010000), mehrfache Leerzeichen zuletzt kollabiert (20261025020000 -- muss NACH der Hausnummer-Umsortierung laufen, sonst bleiben durch die Umsortierung entstandene doppelte Leerzeichen stehen). Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

reindex index core.idx_cp_addr_normalized_postcode;

select * from core.merge_exact_address_duplicates(5000);
