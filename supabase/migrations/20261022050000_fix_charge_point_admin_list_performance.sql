-- Nutzermeldung: /ladestationen (unfiltered Default-Ansicht) schlaegt fehl
-- mit "canceling statement due to statement timeout". Direkt gemessen
-- (EXPLAIN ANALYZE gegen core.charge_point_admin_list()): 18,1s Laufzeit,
-- weit ueber dem PostgREST/Pooler-Statement-Timeout von ca. 8-9s (siehe
-- 20261019020000 fuer die ausfuehrliche Begruendung dieses Limits). Zwei
-- unabhaengige Ursachen in core.charge_point_admin_list() (20260930080000/
-- 20261002000000):
--
--   1. "count(*) over ()" -- ein unbounded Window ueber das GESAMTE
--      gefilterte Ergebnis, bevor LIMIT/OFFSET angewendet wird. Postgres
--      kann LIMIT hier nicht vorziehen, selbst ein perfekter Index fuer die
--      Sortierung haette daran nichts geaendert.
--   2. "order by case when p_sort = 'name_asc' then cp.name end asc, ..."
--      -- eine dynamische Mehrspalten-CASE-Sortierung, die kein Index
--      erfuellen kann (der Planer sieht eine generische Mehrschluessel-
--      Sortierung, nicht "sortiere nur nach name"), erzwingt einen
--      Externen Sort ueber die komplette gefilterte Treffermenge (bestaetigt
--      durch "temp written=4939" in den EXPLAIN-Buffers).
--
-- Fix:
--   1. Gesamtzahl getrennt von der Zeilen-Abfrage berechnen. Ohne aktive
--      Filter: geschaetzter Wert aus pg_class.reltuples (keine Kosten,
--      exakte Zahl fuer eine reine Seitennavigations-Anzeige nicht noetig).
--      Mit Filtern: echtes COUNT(*) mit denselben WHERE-Bedingungen --
--      typischerweise ein kleines gefiltertes Ergebnis, unproblematisch.
--   2. Dynamisches SQL (EXECUTE) mit genau EINER "order by <spalte>
--      <richtung> nulls last"-Klausel je nach p_sort -- dafuer kann ein
--      passender Index tatsaechlich genutzt werden.
-- Zusaetzlich zwei fehlende Indizes ergaenzt (idx_cp_power/idx_cp_country
-- gab es schon, idx_cp_active_name deckt nur is_active=true ab -- die
-- Admin-Liste zeigt aber auch inaktive Stationen, der Teilindex greift dort
-- nicht):
create index if not exists idx_cp_name on core.charge_point (name);
create index if not exists idx_cp_last_seen on core.charge_point (last_seen_at);

-- Der 8-Parameter-Vorgaenger (20260930080000, vor Einfuehrung von p_city in
-- 20261002000000) ist seit 20261002000000 keine echte Ersetzung mehr,
-- sondern eine zusaetzliche, ungenutzte Ueberladung (page.tsx ruft immer
-- mit p_city auf) -- raeumt die Doppeldeutigkeit auf, die "function is not
-- unique"-Fehler bei manuellen/direkten Aufrufen ohne p_city verursacht.
drop function if exists core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer);

create or replace function core.charge_point_admin_list(
    p_q text default null,
    p_country_code text default null,
    p_operator text default null,
    p_verdict text default null,
    p_min_power_kw numeric default null,
    p_sort text default 'name_asc',
    p_limit integer default 30,
    p_offset integer default 0,
    p_city text default null
) returns table(
    id uuid, external_key text, name text, operator text, city text, country_code text,
    max_power_kw numeric, is_operational boolean, is_active boolean, verdict text, total_count bigint
)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_total bigint;
    v_order_col text;
    v_order_dir text;
    v_sql text;
    v_has_filters boolean;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    v_has_filters := p_q is not null or p_city is not null or p_country_code is not null
                      or p_operator is not null or p_verdict is not null or p_min_power_kw is not null;

    if v_has_filters then
        select count(*) into v_total
        from core.charge_point cp
        left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
        where (p_q is null or cp.name ilike '%' || p_q || '%' or cp.operator ilike '%' || p_q || '%')
          and (p_city is null or cp.city ilike '%' || p_city || '%')
          and (p_country_code is null or cp.country_code::text = p_country_code)
          and (p_operator is null or cp.operator = p_operator)
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (
            p_verdict is null
            or (p_verdict = 'checked' and coalesce(ts.verdict, 'unknown') <> 'unknown')
            or (p_verdict = 'unchecked' and coalesce(ts.verdict, 'unknown') = 'unknown')
          );
    else
        select reltuples::bigint into v_total from pg_class where oid = 'core.charge_point'::regclass;
    end if;

    v_order_col := case p_sort
        when 'name_desc' then 'cp.name'
        when 'power_desc' then 'cp.max_power_kw'
        when 'power_asc' then 'cp.max_power_kw'
        when 'country_asc' then 'cp.country_code'
        when 'last_seen_desc' then 'cp.last_seen_at'
        else 'cp.name'
    end;
    v_order_dir := case p_sort
        when 'name_desc' then 'desc'
        when 'power_desc' then 'desc'
        when 'last_seen_desc' then 'desc'
        else 'asc'
    end;

    v_sql := format(
        $sql$
        select cp.id, cp.external_key, cp.name, cp.operator, cp.city, cp.country_code::text,
               cp.max_power_kw, cp.is_operational, cp.is_active,
               coalesce(ts.verdict, 'unknown') as verdict,
               %L::bigint as total_count
        from core.charge_point cp
        left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
        where ($1 is null or cp.name ilike '%%' || $1 || '%%' or cp.operator ilike '%%' || $1 || '%%')
          and ($2 is null or cp.city ilike '%%' || $2 || '%%')
          and ($3 is null or cp.country_code::text = $3)
          and ($4 is null or cp.operator = $4)
          and ($5 is null or cp.max_power_kw >= $5)
          and (
            $6 is null
            or ($6 = 'checked' and coalesce(ts.verdict, 'unknown') <> 'unknown')
            or ($6 = 'unchecked' and coalesce(ts.verdict, 'unknown') = 'unknown')
          )
        order by %s %s nulls last
        limit $7 offset $8
        $sql$,
        v_total, v_order_col, v_order_dir
    );

    return query execute v_sql using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_verdict, p_limit, p_offset;
end;
$$;

comment on function core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer, text) is
  'Fuer /ladestationen (admin). Gesamtzahl getrennt von der Zeilen-Query berechnet (pg_class-Schaetzung ohne Filter, echtes COUNT(*) mit Filtern) statt "count(*) over()" -- vermeidet die Materialisierung des kompletten gefilterten Ergebnisses vor LIMIT. Sortierung per dynamischem SQL mit genau einer ORDER-BY-Spalte je p_sort (statt Mehrspalten-CASE) -- kann dadurch idx_cp_name/idx_cp_power/idx_cp_country/idx_cp_last_seen nutzen. Fix fuer 18s-Timeout bei unfiltered Default-Ansicht, siehe 20261022050000.';

grant execute on function core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer, text) to service_role;
