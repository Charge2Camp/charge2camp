-- Bugfix: admin/(dashboard)/datenqualitaet/woche timeoutete mit "canceling
-- statement due to statement timeout" (entdeckt beim Testen der neuen
-- Fahrzeug-/Wohnwagenmodell-Marken, Migration 20261025060000 fuegte
-- weitere Queries in denselben Promise.all ein). Ursache war bereits vorher
-- vorhanden, nicht durch diese Erweiterung verursacht: die "geaenderte
-- Ladepunkte diese Woche"-Query (core.charge_point mit einer OR-Bedingung
-- ueber source/source_updated_at/updated_at/manual_override) hatte keinen
-- passenden Index und lief per Parallel Seq Scan ueber alle ~68k Zeilen
-- (EXPLAIN ANALYZE: 5.2s bei 2026-09-25) -- direkt an der 8s-Grenze von
-- PostgREST's authenticator-Rolle, durch die zusaetzliche Serverlast der
-- neuen Queries wurde daraus ein tatsaechlicher Timeout. Gleiches Prinzip
-- wie die Ladestationen-Filter-Audits (siehe 202610240*/202610251*
-- Migrationen): Partial-Indizes je OR-Zweig ermoeglichen einen BitmapOr-Plan
-- statt Seq Scan.
create index if not exists idx_cp_ocm_source_updated_at
  on core.charge_point (source_updated_at)
  where source = 'ocm';

create index if not exists idx_cp_non_ocm_updated_at
  on core.charge_point (updated_at)
  where source <> 'ocm';

create index if not exists idx_cp_manual_override_updated_at
  on core.charge_point (updated_at)
  where manual_override;

create index if not exists idx_cp_created_at
  on core.charge_point (created_at);
