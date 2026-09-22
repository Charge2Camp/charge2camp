-- Audit-Befund (2026-09-22, core.run_quality_checks() link_sanity):
-- ingest/build_links.py (Campingplatz<->Ladepunkt-Fussweg-Verknuepfung)
-- hatte bisher nur einen Sanity-Guard gegen zu KURZE Gehstrecken
-- (OSRM-Snapping-Fehler, walk_distance_m < air_distance_m). Das Gegenteil
-- -- eine technisch "echte", aber fuer die Einstufung unbrauchbare
-- Gehstrecke ueber ein Vielfaches der Luftlinie -- wurde nicht abgefangen.
-- Zwei beobachtete Faelle: eine on_site-Verknuepfung mit 63m Luftlinie,
-- aber 26,9km Gehstrecke (vermutlich echter Snapping-Fehler); mehrere
-- Faelle am Comer See mit 366km Gehstrecke (vermutlich technisch korrekte,
-- aber irrelevante Rund-um-den-See-Route mangels Bruecke). ingest/
-- build_links.py hat jetzt denselben Guard auch fuer diese Richtung (siehe
-- IMPLAUSIBLE_DETOUR_FACTOR dort) -- diese Migration bereinigt die bereits
-- betroffenen BESTEHENDEN Zeilen, ohne auf den naechsten manuellen
-- build_links.py-Lauf zu warten.
--
-- Nutzerseitig unkritisch (zur Einordnung, kein aktiver Bug fuer echte
-- Nutzer): src/app/api/campsites/[external_key]/route.ts setzt
-- walk_distance_m fuer relation='on_site' ohnehin hart auf 0, und
-- src/lib/campsite-charging-links.ts filtert jede Verknuepfung mit
-- walk_duration_s > 900s (15 Min) aus der "Ladepunkte in der Naehe"-Liste
-- -- beide betroffenen Faelle waeren dort schon vorher unsichtbar
-- geblieben. Die Bereinigung ist trotzdem sinnvoll: saubere Rohdaten fuer
-- jeden kuenftigen Verbraucher dieser Tabelle, korrekte link_sanity-Zahl.
--
-- relation aendert sich durch diese Bereinigung NICHT: ingest/
-- build_links.py.classify() nutzt walk_distance_m nur fuer die
-- "walking"-Klassifizierung (<=1200m) -- keine der betroffenen Zeilen war
-- vorher 'walking' (alle bereits 'on_site' ueber die Luftlinien-Schwelle
-- oder 'nearby_drive'), ein NULL-Wert aendert an dieser Einstufung nichts.
update core.campsite_charge_link
set walk_distance_m = null,
    walk_duration_s = null
where walk_distance_m is not null
  and walk_distance_m > greatest(5000, air_distance_m * 10);
