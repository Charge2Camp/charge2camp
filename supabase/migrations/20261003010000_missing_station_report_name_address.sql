-- Ergaenzung zu enrich.missing_station_report (siehe 20261003000000):
-- Nutzerfeedback "was ist mit Adresse, Betreiber" -- Adresse laesst sich per
-- Reverse-Geocoding (eigene OSM-Daten via Nominatim) aus den erkannten
-- Koordinaten ableiten, ein Namens-Hinweis steht oft direkt im URL-Pfad
-- eines Google-Maps-Links (".../maps/place/<Name>/@...") bzw. im
-- q-Parameter einer Such-URL. Strukturierte Adressfelder (nicht ein langer
-- Textblock) passend zu den getrennten Formularfeldern in
-- admin/components/charge-point-form.tsx. `extracted_name` ist NUR ein
-- Vorschlag -- ob das eher der Stationsname oder der Betreiber ist, kann
-- aus der URL allein nicht sicher unterschieden werden, siehe
-- src/lib/maps-link.ts.
alter table enrich.missing_station_report
  add column extracted_name text,
  add column extracted_street text,
  add column extracted_postcode text,
  add column extracted_city text,
  add column extracted_country_code text;
