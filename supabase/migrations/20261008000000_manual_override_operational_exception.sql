-- Dokumentiert die Ausnahme vom manual_override-Schutz, die in
-- ingest/import_ocm.py (UPSERT_CORE_SQL) umgesetzt ist: meldet OCM eine
-- Saeule als NICHT betriebsbereit, wird is_operational=false auch bei
-- gesetztem manual_override uebernommen -- Datenqualitaet zu "ausser
-- Betrieb" hat hier Vorrang vor dem sonst geltenden Schutz einer manuellen
-- Admin-Korrektur (Nutzervorgabe). Keine Schemaaenderung, nur ein
-- aktualisierter Spaltenkommentar zur Dokumentation dieses Verhaltens.
comment on column core.charge_point.manual_override is
  'Wenn true: OCM-Reimport ueberschreibt name/operator/address/city/country_code/access_type/max_power_kw/geom NICHT mehr (siehe admin ladestationen/[id] Bearbeitung). Ausnahme: is_operational=false aus dem Import wird IMMER uebernommen, auch bei manual_override=true (siehe UPSERT_CORE_SQL in ingest/import_ocm.py) -- Datenaktualitaet zu ausser Betrieb hat Vorrang.';
