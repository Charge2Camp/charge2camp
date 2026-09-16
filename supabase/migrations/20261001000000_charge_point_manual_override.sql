-- Admin-Korrekturen an core.charge_point (Name, Betreiber, Adresse, Ort,
-- Land, Zugang, Betriebsbereitschaft, Leistung, Koordinaten -- siehe
-- admin/app/(dashboard)/ladestationen/[id]/actions.ts updateChargePoint)
-- wurden bislang beim naechsten OCM-Reimport (ingest/import_ocm.py,
-- taeglicher Vercel Cron) wieder ueberschrieben, weil der ON CONFLICT-Zweig
-- dort bedingungslos excluded.* schreibt. Nutzerfeedback: bei vielen
-- Stadtwerke-Saeulen steht faelschlich "Ladenetz.de" (das Roaming-/
-- Abrechnungsnetzwerk aus OCM) statt des echten Betreibers als operator --
-- eine manuelle Korrektur haette ohne dieses Flag jede Nacht wieder
-- rueckgaengig gemacht.
--
-- manual_override folgt demselben Prinzip wie das bereits bestehende
-- is_active (siehe Kommentar im UPSERT_CORE_SQL in import_ocm.py): einmal
-- vom Admin gesetzt, gewinnt der bestehende Wert gegen einen Reimport.
alter table core.charge_point
  add column manual_override boolean not null default false;

comment on column core.charge_point.manual_override is
  'Wenn true: OCM-Reimport ueberschreibt name/operator/address/city/country_code/access_type/is_operational/max_power_kw/geom NICHT mehr (siehe admin ladestationen/[id] Bearbeitung).';
