-- Nutzervorgabe (2026-09-25): "verbleibende Dubletten nach Adress-
-- Aehnlichkeit sortiert pruefen". Stichprobe der 48 Paare mit maximaler
-- (Trigram-)Adress-Aehnlichkeit (core.quality_check_cache, addr_sim = 1.0)
-- zeigt ein durchgaengiges Muster: BNetzA schreibt Hausnummern NACH dem
-- Strassennamen ("Im langen Feld 17"), OCM DAVOR ("17 Im Langen Feld") --
-- dieselbe Adresse, aber core.normalize_address_for_dedup() vergleicht nur
-- auf exakte String-Gleichheit NACH der Normalisierung und kennt keine
-- Wortstellung, "im langen feld 17" <> "17 im langen feld" als String,
-- tier9_exact_address/core.merge_exact_address_duplicates() erfassen das
-- Paar deshalb nicht, obwohl es dieselbe Adresse ist (Trigram-Aehnlichkeit
-- erkennt es trotzdem, da sie wortstellungs-unabhaengig ist -- daher
-- addr_sim = 1.0 bei genau diesen Paaren).
--
-- Fix: fuehrende Hausnummer(n) (inkl. Buchstabensuffix wie "17a" und
-- mehrteilige Spannen wie "195-211", die der vorherige Schritt bereits zu
-- "195 211" auftrennt) ans Ende verschieben, WENN der Rest mit einem
-- Buchstaben beginnt (verhindert Fehlgriffe bei rein numerischen/kaputten
-- Adressen ohne erkennbaren Strassennamen -- dort bleibt die Eingabe
-- unveraendert). Adressen, die bereits mit dem Strassennamen beginnen
-- (BNetzA-Stil), matchen den Musteranfang "^\d..." nicht und bleiben
-- unveraendert -- die Funktion ist damit fuer beide Schreibrichtungen
-- idempotent und ergibt in beiden Faellen dieselbe kanonische Form
-- "strassenname hausnummer(n)".
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
                    '\s+', ' ', 'g'
                ),
                '^((?:\d+[a-z]?\s+)*\d+[a-z]?)\s+([a-zäöüß].*)$', '\2 \1', 'g'
            )
        ),
        ''
    )
$$;

comment on function core.normalize_address_for_dedup(text) is
  'Normalisiert Adress-Strings fuer den Dubletten-Abgleich: alles ab einer 5-stelligen PLZ abgeschnitten, Satzzeichen zu Leerzeichen, "Straße"/"Strasse" zu "Str" kanonisiert (20261024020000), mehrfache Leerzeichen kollabiert, fuehrende Hausnummer(n) ans Zeilenende verschoben (20261025010000 -- BNetzA schreibt "Strasse Nr.", OCM "Nr. Strasse", sonst gelten identische Adressen faelschlich als verschieden). Siehe core.auto_merge_charge_point_duplicates() (20261021000000).';

-- Funktionaler Index (20261024000000) auf denselben Funktionsnamen neu
-- aufbauen -- IMMUTABLE-Funktionsaenderungen werden von Postgres nicht
-- automatisch nachgezogen (siehe 20261024020000, gleiches Vorgehen).
reindex index core.idx_cp_addr_normalized_postcode;

-- Nachlauf: durch die neue Normalisierung werden bisher NICHT als
-- "exakt gleiche Adresse" erkannte Paare (Hausnummer-Wortstellung) jetzt
-- erfasst -- core.merge_exact_address_duplicates() erneut ausfuehren, damit
-- sie nicht bis zum naechsten naechtlichen Lauf liegen bleiben.
select * from core.merge_exact_address_duplicates(5000);
