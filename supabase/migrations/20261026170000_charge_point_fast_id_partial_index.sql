-- Partieller Index in id-Reihenfolge fuer Schnelllader (>= 150 kW), damit die
-- id-Stichprobe von core.charge_points_in_bbox beim Standard-Leistungsfilter wieder
-- fruehzeitig abbrechen kann.
--
-- Ausgangslage (Produktion, padded Europa-Ausschnitt, 150 kW): seit 20261026140000
-- sortiert die Funktion nach id statt nach name. Mit Namenssortierung konnte der
-- Planer den Teilindex idx_cp_active_fast_name in Namensreihenfolge ablaufen und nach
-- 1.500 Treffern stoppen (~77 ms). In id-Reihenfolge gibt es keinen solchen Index; der
-- Planer waehlt Bitmap-Scan (GiST + Leistung) ueber ALLE ~16.000 passenden Ladepunkte
-- (11.120 Buffers), sortiert sie nach id und nimmt dann 1.500: ~360-440 ms nur fuer die
-- Kandidatenauswahl, vollstaendig durch den Leistungsfilter bedingt -- nicht durch die
-- Verdict-Pruefung (Gesamtlaufzeit der Funktion 150 kW: no-verdict 361 ms, unknown
-- 586-906 ms warm; jeweils ohne Leistungsfilter dagegen ~125 ms).
--
-- Dieser Index enthaelt nur die ~16.000 Schnelllader (< 1 MB). Der Planer kann ihn in
-- id-Reihenfolge ablaufen, die bbox je Zeile am Heap pruefen und nach 1.500 Treffern
-- stoppen. Das Praedikat "is_active and max_power_kw >= 150" wird auch von Auswahlen
-- mit hoeherer Mindestleistung (300 kW) impliziert und genutzt. Fuer kleine
-- Kartenausschnitte bleibt der GiST-Index guenstiger (lokal geprueft: weiterhin
-- Bitmap Index Scan auf idx_cp_geom). Ohne Leistungsfilter bzw. mit 50 kW genuegt der
-- Primaerschluessel.
--
-- Lokal geprueft (Plan wechselt auf den neuen Index, kleine bbox unveraendert); die
-- Wirkung in Produktion ist NICHT gemessen -- lokal waehlte der Planer schon vorher den
-- Primaerschluessel-Scan (40 % der synthetischen Ladepunkte sind >= 150 kW, in
-- Produktion nur 13 %). Nach dem Anwenden dieselben Aufrufe read-only nachmessen; bei
-- Nichtnutzung einfach wieder droppen.
create index if not exists idx_cp_active_fast_id
    on core.charge_point (id)
    where is_active and max_power_kw >= 150;
