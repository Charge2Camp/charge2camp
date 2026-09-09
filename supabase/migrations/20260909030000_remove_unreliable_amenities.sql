-- Auf Nutzerwunsch entfernt: sechs core.amenity-Merkmale gelten als
-- unzuverlaessig/nicht aussagekraeftig und sollen weder in Filtern/
-- Kartenkarten angezeigt noch fuer irgendetwas herangezogen werden
-- (Scoring nutzt core.amenity ohnehin nicht, siehe ev-camping-score.ts).
--
-- Filter (quick-filters.tsx, filter-form.tsx), Karten-Badges
-- (campsite-explorer.tsx) und das Admin-Merkmale-Formular lesen core.
-- amenity dynamisch -- ein geloeschtes Merkmal verschwindet dadurch
-- automatisch ueberall, ohne Code-Aenderung.
--
-- Reihenfolge wichtig: core.campsite_amenity.amenity_key hat einen FK OHNE
-- ON DELETE CASCADE auf core.amenity(key) (siehe
-- 20260913000000_data_layer_schema.sql:143) -- zuerst die verknuepften
-- Datenzeilen loeschen, danach den Katalogeintrag selbst.
delete from core.campsite_amenity
where amenity_key in (
    'wifi',              -- WLAN
    'sanitary_heated',   -- Beheizte Sanitäranlagen
    'hardstanding',      -- Befestigter Untergrund
    'shaded_pitches',    -- Schattige Plätze
    'caravans_allowed',  -- Wohnwagen erlaubt
    'trailer_friendly'   -- Anhängertaugliche Zufahrt
);

delete from core.amenity
where key in (
    'wifi', 'sanitary_heated', 'hardstanding', 'shaded_pitches', 'caravans_allowed', 'trailer_friendly'
);

-- core.campsite_search.amenities ist ein vorberechnetes array_agg aus
-- core.campsite_amenity -- ohne Refresh wuerden geloeschte Merkmale bis zum
-- naechsten Ingest-Lauf in der App weiter auftauchen (materialized view,
-- siehe core.refresh_campsite_search() aus
-- 20260909020000_campsite_charge_point_active_flag.sql).
select core.refresh_campsite_search();
