-- Fortsetzung von 20261022050000/060000: Nutzermeldung "beim Filtern kommt
-- wieder der Timeout". Zwei zusammenhaengende Ursachen gefunden:
--
--   1. Die WHERE-Klausel verglich "cp.country_code::text = $3" -- ein Cast
--      AUF DIE SPALTE. country_code ist vom Typ "character" (bpchar), nicht
--      text. Ein Cast auf die Spalte verhindert, dass Postgres die
--      Spalten-Statistiken (MCV-Liste/Histogramm) fuer die Selektivitaets-
--      schaetzung nutzt -- selbst nach frischem ANALYZE blieb die Schaetzung
--      bei 844 Zeilen fuer country_code='DE', tatsaechlich sind es 86.071
--      (~43% der Tabelle). Gemessen: Cast auf den Parameter statt die
--      Spalte ("cp.country_code = $3::bpchar") behebt die Schaetzung
--      (87.224 geschaetzt vs. 86.071 tatsaechlich).
--   2. ABER: mit korrekter Schaetzung waehlt der Planer einen Index-Scan --
--      und der ist fuer 43% der Tabelle LANGSAMER als ein Sequential Scan
--      (Random- statt Linear-I/O), 19,2s statt 5,4-9s. Das eigentliche
--      Problem ist die schiere Datenmenge, kein falscher Index/keine
--      falsche Schaetzung mehr -- ein echtes COUNT(*) ueber einen grossen
--      Anteil einer 380MB-Tabelle braucht schlicht mehrere Sekunden I/O,
--      unabhaengig vom gewaehlten Plan.
--
-- Fix: Gesamtzahl (total_count) nie mehr per echtem COUNT(*) berechnen,
-- auch nicht gefiltert -- stattdessen die Planer-Schaetzung aus EXPLAIN
-- (FORMAT JSON) verwenden (plant die Query, fuehrt sie NICHT aus -- Kosten
-- im Millisekundenbereich, unabhaengig von der Tabellengroesse). Fuer eine
-- reine Seitennavigations-Anzeige ("X gesamt") ist eine gute Schaetzung
-- ausreichend, exakt muss sie nicht sein. Die eigentliche Zeilen-Query
-- (LIMIT/OFFSET) bleibt exakt und schnell, weil sie dank Fix 1 jetzt den
-- richtigen Index waehlen kann (LIMIT erlaubt fruehen Abbruch, unabhaengig
-- von der Gesamttrefferzahl).
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
    v_where text;
    v_sql text;
    v_explain jsonb;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    v_where := $where$
        ($1 is null or cp.name ilike '%' || $1 || '%' or cp.operator ilike '%' || $1 || '%')
        and ($2 is null or cp.city ilike '%' || $2 || '%')
        and ($3 is null or cp.country_code = $3::bpchar)
        and ($4 is null or cp.operator = $4)
        and ($5 is null or cp.max_power_kw >= $5)
        and (
          $6 is null
          or ($6 = 'checked' and coalesce(ts.verdict, 'unknown') <> 'unknown')
          or ($6 = 'unchecked' and coalesce(ts.verdict, 'unknown') = 'unknown')
        )
    $where$;

    execute format(
        'explain (format json) select 1 from core.charge_point cp
         left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
         where %s',
        v_where
    ) into v_explain using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_verdict;
    v_total := round((v_explain -> 0 -> 'Plan' ->> 'Plan Rows')::numeric);

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
        'select cp.id, cp.external_key, cp.name, cp.operator, cp.city, cp.country_code::text,
                cp.max_power_kw, cp.is_operational, cp.is_active,
                coalesce(ts.verdict, ''unknown'') as verdict,
                %L::bigint as total_count
         from core.charge_point cp
         left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
         where %s
         order by %s %s nulls last
         limit $7 offset $8',
        v_total, v_where, v_order_col, v_order_dir
    );

    return query execute v_sql using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_verdict, p_limit, p_offset;
end;
$$;

comment on function core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer, text) is
  'Fuer /ladestationen (admin). total_count kommt aus dem Planer-Zeilenschaetzwert (EXPLAIN FORMAT JSON, plant nur, fuehrt nicht aus) statt echtem COUNT(*) -- ein exaktes COUNT(*) ueber einen grossen Anteil der Tabelle (z. B. country_code=DE = ~43%) braucht mehrere Sekunden reines I/O, unabhaengig vom Plan (20261022070000). country_code wird als bpchar verglichen (Cast auf den Parameter, nicht auf die Spalte) -- ein Cast auf die Spalte verhindert, dass der Planer die Spaltenstatistik fuer die eigentliche Zeilen-Query nutzt.';
