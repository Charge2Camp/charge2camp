-- Fortsetzung des systematischen Timeout-Nachtests: city=Berlin (Freitext-
-- ILIKE, ueber idx_cp_city_trgm, 20261024110000) + sort=last_seen_desc
-- gemessen 15,7s -- ueber dem 8s-Timeout. Gleiche Ursache wie beim
-- urspruenglichen Namens-/Anbieter-Text-Suche-Problem (20261022090000):
-- bei einem Sortier-Kriterium ohne Korrelation zum Text-Treffer waehlt der
-- Planer einen Index-Scan in Sortierreihenfolge mit Zeile-fuer-Zeile-Filter
-- statt des Bitmap-Scans ueber idx_cp_city_trgm. Anders als bei
-- source/is_active (20261024160000) hilft hier kein zusammengesetzter Index
-- -- ILIKE mit fuehrendem Wildcard ist nur ueber den GIN-Trigram-Index
-- sargable, nicht ueber einen btree(city, last_seen_at). Stattdessen:
-- derselbe "set local enable_indexscan = off"-Trick wie bei p_q, jetzt auch
-- fuer p_city aktiv. Getestet (EXPLAIN ANALYZE auf Produktion): 146ms statt
-- 15,7s (Bitmap Heap Scan ueber idx_cp_city_trgm + Sort statt Index Scan +
-- Filter). Keine Regression fuer die bereits schnellen city-Faelle erwartet
-- (Berlin/name_asc vorher 1,7s, Treffermenge bleibt mit ~3.600 Zeilen klein
-- genug fuer eine guenstige Sortierung).
create or replace function core.charge_point_admin_list(
    p_q text default null,
    p_country_code text default null,
    p_operator text default null,
    p_verdict text default null,
    p_min_power_kw numeric default null,
    p_sort text default 'name_asc',
    p_limit integer default 30,
    p_offset integer default 0,
    p_city text default null,
    p_is_active boolean default null,
    p_source text default null
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
    v_cte text := '';
    v_from text;
    v_sql text;
    v_explain jsonb;
    v_source_selective boolean := false;
    v_source_est jsonb;
    v_cte_join text;
    v_cte_cond text;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    if p_source is not null then
        execute format('explain (format json) select 1 from core.charge_point where source = %L', p_source)
          into v_source_est;
        v_source_selective := round((v_source_est -> 0 -> 'Plan' ->> 'Plan Rows')::numeric) < 5000;
    end if;

    v_where := $where$
        ($1 is null or cp.name ilike '%' || $1 || '%' or cp.operator ilike '%' || $1 || '%')
        and ($2 is null or cp.city ilike '%' || $2 || '%')
        and ($3 is null or cp.country_code = $3::bpchar)
        and ($4 is null or cp.operator = $4)
        and ($5 is null or cp.max_power_kw >= $5)
        and ($6 is null or cp.is_active = $6)
        and ($7 is null or cp.source = $7)
    $where$;

    if p_verdict = 'unchecked' then
        v_where := v_where || $unchecked$ and coalesce(ts.verdict, 'unknown') = 'unknown'$unchecked$;
    end if;

    if p_verdict = 'checked' or v_source_selective then
        v_cte_join := case when p_verdict = 'checked'
            then 'join enrich.trailer_suitability ts2 on ts2.charge_point_key = cp.external_key'
            else ''
        end;
        v_cte_cond := case
            when p_verdict = 'checked' and v_source_selective
                then format('ts2.verdict in (''no'', ''yes'', ''unhitch'') and cp.source = %L', p_source)
            when p_verdict = 'checked'
                then 'ts2.verdict in (''no'', ''yes'', ''unhitch'')'
            else format('cp.source = %L', p_source)
        end;
        v_cte := format(
            $cte$
                with candidate_ids as materialized (
                    select cp.id from core.charge_point cp %s where %s
                )
            $cte$,
            v_cte_join, v_cte_cond
        );
        v_from := $from$
            core.charge_point cp
            join candidate_ids ci on ci.id = cp.id
            left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
        $from$;
    else
        v_from := 'core.charge_point cp left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key';
    end if;

    execute format(
        'explain (format json) %s select 1 from %s where %s',
        v_cte, v_from, v_where
    ) into v_explain using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_is_active, p_source;
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
        '%s select cp.id, cp.external_key, cp.name, cp.operator, cp.city, cp.country_code::text,
                cp.max_power_kw, cp.is_operational, cp.is_active,
                coalesce(ts.verdict, ''unknown'') as verdict,
                %L::bigint as total_count
         from %s
         where %s
         order by %s %s nulls last
         limit $8 offset $9',
        v_cte, v_total, v_from, v_where, v_order_col, v_order_dir
    );

    -- Fix (20261024170000): auch bei aktivem Stadt-Filter den Bitmap-Scan
    -- ueber idx_cp_city_trgm erzwingen, nicht nur bei Textsuche (p_q).
    if p_q is not null or p_city is not null then
        set local enable_indexscan = off;
    end if;

    return query execute v_sql
      using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_is_active, p_source, p_limit, p_offset;
end;
$$;

comment on function core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer, text, boolean, text) is
  'Fuer /ladestationen (admin). total_count kommt aus der Planer-Zeilenschaetzung (EXPLAIN FORMAT JSON) statt echtem COUNT(*). country_code wird als bpchar verglichen (Cast auf den Parameter, nicht die Spalte). Bei aktiver Textsuche (p_q) ODER aktivem Stadt-Filter (p_city, seit 20261024170000) erzwingt "set local enable_indexscan = off" den Bitmap-Scan ueber idx_cp_name_trgm/idx_cp_operator_trgm/idx_cp_city_trgm statt des sonst gewaehlten, bei manchen Sortierungen langsameren und cache-abhaengigen Index-Order-Scans. p_verdict=''checked'' und/oder ein selektiver p_source-Wert (Selektivitaet per EXPLAIN geschaetzt, Schwelle 5.000 Zeilen) filtern ueber eine materialisierte CTE auf idx_ts_verdict/idx_cp_source vor. Nicht-selektive p_source-Werte nutzen zusaetzlich idx_cp_source_lastseen/idx_cp_active_lastseen (20261024160000) fuer sort=last_seen_desc. SET LOCAL gilt nur fuer die aktuelle Transaktion/den aktuellen RPC-Aufruf.';
