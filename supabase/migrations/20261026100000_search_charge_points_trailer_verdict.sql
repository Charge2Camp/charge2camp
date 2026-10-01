-- Trailer-Verdict-Filter fuer den nicht-bbox-Pfad (Server-Erstansicht ohne
-- bekannten Kartenausschnitt, fetchChargingStations in src/lib/charging-
-- stations.ts) direkt in SQL, statt erst NACH dem Laden und Anreichern in
-- JS. Bisher lud dieser Pfad bis zu `limit` (max. 5000) Ladepunkte
-- alphabetisch, reicherte ALLE per Connector-/Trailer-Batch-Queries an
-- (~34 Batches je Tabelle) und behielt danach per JS-Filter nur die
-- ~1,6 % mit geprueftem Verdict. Zusaetzlich fehlten Treffer jenseits der
-- ersten N Namen (trailerVerdictNeedsWiderSearch in ladepunkte/page.tsx
-- mildert das nur ab).
--
-- BEWUSST EINE NEUE, SEPARATE FUNKTION statt Erweiterung von
-- core.search_charge_points():
--   * core.search_charge_points() ist eine inlinebare SQL-Funktion (kein
--     "set search_path", kein order/limit im Koerper, siehe 20261025150000/
--     160000) -- sie bleibt unveraendert schnell fuer den Fall ohne
--     Verdict-Filter. Ein neuer Parameter dort braeuchte ein DROP der alten
--     Signatur (Overload-Falle) und wuerde das Inlining-Risiko erneut
--     eingehen.
--   * Die Selektivitaet von p_trailer_verdicts ist VORAB bekannt ('unknown'
--     ~98,4 %, yes/unhitch/no zusammen ~1,6 %). Eine einzelne gemeinsame
--     Query fuehrte bei core.charge_points_in_bbox() wiederholt zu Plan-
--     Regressionen (35-58s, siehe 20261025100000/110000/120000/130000).
--     Loesung dort und hier: IF/ELSE mit statischem SQL in getrennten
--     Codepfaden einer PL/pgSQL-Funktion, damit Postgres je Pfad einen
--     eigenen Plan kalibriert. PL/pgSQL ist nicht inlinebar -- deshalb
--     order/limit hier INNERHALB der Funktion (p_limit), nicht ueber
--     PostgREST aussen.
--
-- Semantik identisch zum bisherigen JS-Filter ("r.trailer &&
-- verdicts.includes(r.trailer.verdict)"): Ladepunkte OHNE Eintrag in
-- enrich.trailer_suitability fallen bei gesetztem Filter heraus.
-- security invoker und KEIN "set search_path" wie core.search_charge_points()
-- (reine Lesefunktion); alle Tabellenverweise sind schemaqualifiziert.
--
-- Neue Funktion, daher kein DROP noetig (kein bestehender Overload mit
-- diesem Namen). Aufrufer-Umstellung in src/lib/charging-stations.ts folgt
-- separat: bei trailerVerdict.length > 0 diese Funktion mit p_limit
-- aufrufen (ohne .order()/.limit()), sonst weiter core.search_charge_points().
--
-- NICHT live gemessen. Vor dem Produktions-Push lokal mit synthetischen
-- Daten (98,4 %/1,6 %-Verteilung, wiederholte Aufrufe zur Provokation von
-- generic plans) und per EXPLAIN (ANALYZE, BUFFERS) read-only gegen
-- Produktion pruefen, jeweils mit nur 'yes', mit 'unknown' und mit
-- p_connector_standards/p_q kombiniert.
create or replace function core.search_charge_points_by_verdict(
    p_trailer_verdicts text[],
    p_q text default null,
    p_operators text[] default null,
    p_min_power_kw numeric default null,
    p_connector_standards text[] default null,
    p_limit integer default 5000
)
returns setof core.charge_point_geo
language plpgsql
stable
security invoker
as $$
begin
    if p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0
       and not ('unknown' = any(p_trailer_verdicts)) then
        -- Selektiver Fall (nur yes/unhitch/no, ~1,6 %): materialisierte CTE
        -- grenzt zuerst ueber idx_ts_verdict ein, bevor gejoint wird.
        return query
        with matching_keys as materialized (
            select charge_point_key
            from enrich.trailer_suitability
            where verdict = any(p_trailer_verdicts)
        )
        select cpg.*
        from core.charge_point_geo cpg
        join matching_keys mk on mk.charge_point_key = cpg.external_key
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
        order by cpg.name
        limit p_limit;
    elsif p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0 then
        -- Nicht-selektiver Fall ('unknown' enthalten, ~98,4 %+): einfaches
        -- EXISTS auf dem PK (charge_point_key), keine Materialisierung.
        return query
        select cpg.*
        from core.charge_point_geo cpg
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
          and exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cpg.external_key and ts.verdict = any(p_trailer_verdicts)
          )
        order by cpg.name
        limit p_limit;
    else
        -- Kein Verdict-Filter: Verhalten wie core.search_charge_points().
        return query
        select cpg.*
        from core.charge_point_geo cpg
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
        order by cpg.name
        limit p_limit;
    end if;
end;
$$;

grant execute on function core.search_charge_points_by_verdict(text[], text, text[], numeric, text[], integer) to service_role;

comment on function core.search_charge_points_by_verdict(text[], text, text[], numeric, text[], integer) is
  'Nicht-bbox-Pfad von fetchChargingStations (src/lib/charging-stations.ts) MIT Trailer-Verdict-Filter. Verzweigt wie core.charge_points_in_bbox() (20261025130000) nach VORAB bekannter Selektivitaet in getrennte Codepfade: ohne ''unknown'' (yes/unhitch/no, ~1,6 %) materialisierte CTE auf idx_ts_verdict, mit ''unknown'' (~98,4 %+) einfaches EXISTS auf enrich.trailer_suitability(charge_point_key). PL/pgSQL (nicht inlinebar), deshalb order by name + p_limit im Koerper. Ohne Verdict-Filter weiterhin core.search_charge_points() verwenden (inlinebare SQL-Funktion, kein order/limit/search_path im Koerper). Ladepunkte ohne trailer_suitability-Eintrag fallen bei gesetztem Filter heraus (wie der bisherige JS-Filter). Rueckgabeform identisch zu core.charge_point_geo.';
