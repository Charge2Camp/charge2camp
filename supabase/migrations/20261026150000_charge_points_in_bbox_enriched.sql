-- Anreicherung des Ladepunkte-Viewports in EINEM Datenbank-Roundtrip statt ~20
-- gebatchten PostgREST-Abfragen -- und mit deutlich weniger Datenbankarbeit.
--
-- Ausgangslage (gemessen in Produktion, padded Europa-Ausschnitt, 1.500 Stationen):
--   * fetchChargingStations (bbox-Zweig) holte Connectoren und Trailer-Daten per
--     enrichStations in je 10 Batches zu 150 IDs (20 Abfragen, bis zu 16 parallele
--     Verbindungen, select("*")).
--   * Einzelabfrage Connectoren fuer die 1.500 IDs: 3,3 s kalt / 50 ms warm;
--     Trailer: 0,64 s kalt / 97 ms warm. Im verschachtelten Zugriff kosten selbst
--     bei vollem Cache 1.500 PK-Lookups auf enrich.trailer_suitability ~1,15 s
--     (0,77 ms je Lookup) und 1.500 Connector-Lookups ~0,55 s.
--   * select("*") lieferte Spalten, die der Client nie liest: geom (Station),
--     verified_by (Nutzer-UUID!), manual_override, source_type, created_at/
--     updated_at (Trailer-Zeile).
--
-- Loesungsteile:
--   1) core.connector: covering index (charge_point_id) include (alle uebrigen
--      Spalten) -> Index-Only-Scan; die ~4.500 Connectoren von 1.500 Stationen
--      liegen im Index zusammenhaengend statt verstreut im Heap (kalter Cache).
--   2) enrich.trailer_suitability: Teilindex NUR auf "aussagekraeftige" Zeilen.
--      134.801 von 137.287 Zeilen sind reine Platzhalter (verdict 'unknown',
--      origin 'auto', ohne Notiz/drive_through; 0 davon tragen weitere Daten --
--      geprueft). Fuer den Client sind sie von "kein Eintrag" nicht
--      unterscheidbar: getReviewState('auto') = getReviewState(null) =
--      "Noch nicht bewertet", Pin 'ungeprueft' fuer 'unknown' wie fuer null, die
--      Karte liest nur verdict/origin/notes/drive_through. Der Teilindex hat ~2.500
--      statt 137.000 Eintraege; fuer Platzhalter wird gar nicht erst gesucht.
--   3) core.charge_points_in_bbox_enriched(): ruft die bestehende, bewaehrte
--      core.charge_points_in_bbox() (SET-Klauseln, Verdict-Pfade, id-Stichprobe
--      bleiben unveraendert) und haengt je Station "connectors" (Array) und
--      "trailer" (Objekt oder null) an. Ausgabe nur mit den vom Client genutzten
--      Feldern (ChargingStationView/CoreConnector/TrailerSuitabilityRecord).
--
-- Rueckgabe "setof jsonb" statt einer festen Spaltenliste: kein Anpassen an
-- Schemaaenderungen von core.charge_point_geo. Neue Funktion -> kein bestehender
-- Overload, kein DROP noetig. security invoker (reine Lesefunktion; die innere
-- Funktion bleibt security definer wie bisher), alle Verweise schemaqualifiziert.
--
-- Semantik-Hinweis: Fuer reine Platzhalter liefert "trailer" jetzt null statt eines
-- Objekts mit verdict 'unknown'. Der Client-Filter auf trailer.verdict fuer den
-- bbox-Pfad entfaellt dafuer (filtert ohnehin schon SQL-seitig in
-- core.charge_points_in_bbox).
--
-- Lokal getestet (Aequivalenz zur alten Anreicherung); NICHT in Produktion
-- angewendet/gemessen.

-- 1) Covering Index fuer die Connector-Anreicherung
create index if not exists idx_conn_cp_covering
    on core.connector (charge_point_id)
    include (id, standard, power_kw, current_type, quantity);

-- 2) Teilindex nur fuer aussagekraeftige Trailer-Zeilen (Praedikat muss in der
--    Funktion unten WOERTLICH wiederkehren, sonst nutzt der Planer ihn nicht)
create index if not exists idx_ts_meaningful
    on enrich.trailer_suitability (charge_point_key)
    where not (verdict = 'unknown' and origin = 'auto' and notes is null and drive_through is null);

-- 3) Angereicherte Viewport-Abfrage
create or replace function core.charge_points_in_bbox_enriched(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null
)
returns setof jsonb
language sql
stable
security invoker
as $$
    select
        (to_jsonb(s) - 'geom')
        || jsonb_build_object(
            'connectors', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'id', c.id,
                        'charge_point_id', c.charge_point_id,
                        'standard', c.standard,
                        'power_kw', c.power_kw,
                        'current_type', c.current_type,
                        'quantity', c.quantity
                    )
                    order by c.id
                )
                from core.connector c
                where c.charge_point_id = s.id
            ), '[]'::jsonb),
            'trailer', (
                select jsonb_build_object(
                    'charge_point_key', ts.charge_point_key,
                    'verdict', ts.verdict,
                    'drive_through', ts.drive_through,
                    'pull_in_length_m', ts.pull_in_length_m,
                    'maneuvering_space', ts.maneuvering_space,
                    'notes', ts.notes,
                    'origin', ts.origin,
                    'confirm_count', ts.confirm_count,
                    'dispute_count', ts.dispute_count,
                    'verified_at', ts.verified_at
                )
                from enrich.trailer_suitability ts
                where ts.charge_point_key = s.external_key
                  and not (ts.verdict = 'unknown' and ts.origin = 'auto' and ts.notes is null and ts.drive_through is null)
            )
        )
    from core.charge_points_in_bbox(
        p_west, p_south, p_east, p_north, p_min_power_kw, p_q, p_limit, p_trailer_verdicts
    ) s
$$;

grant execute on function core.charge_points_in_bbox_enriched(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) to service_role;

comment on function core.charge_points_in_bbox_enriched(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) is
  'Viewport-Abfrage mit Anreicherung in einem Roundtrip (fetchChargingStations bbox-Zweig, src/lib/charging-stations.ts): ruft core.charge_points_in_bbox() und haengt je Station "connectors" (Array) und "trailer" (Objekt oder null) an, nur mit den vom Client genutzten Feldern (ohne geom, verified_by u. a.). Reine Platzhalter-Zeilen von enrich.trailer_suitability (verdict unknown, origin auto, ohne Notiz/drive_through) liefern trailer = null -- fuer den Client identisch zu "kein Eintrag". Nutzt idx_conn_cp_covering (Index-Only) und den Teilindex idx_ts_meaningful. Siehe Migrationskommentar 20261026150000.';
