-- Bugreport: /ladestationen (admin) mit Filter "Nur geprüft" -- "canceling
-- statement due to statement timeout". Andere Ursache als die vorherigen
-- beiden Timeout-Fixes (fehlender Index): hier waehlt der Planer trotz
-- vorhandenem idx_ts_verdict eine schlechte Strategie, weil "checked" nur
-- ~1,6% aller Zeilen betrifft (2.245 von 137.776, siehe
-- enrich.trailer_suitability.verdict-Verteilung) UND die WHERE-Bedingung
-- "coalesce(ts.verdict, 'unknown') <> 'unknown'" erst NACH dem LEFT JOIN
-- ausgewertet werden kann (coalesce verhindert Pushdown auf ts.verdict).
-- Der Planer nutzt deshalb die LIMIT 30 + ORDER BY-Heuristik: charge_point
-- in Sortierreihenfolge scannen, pro Zeile einzeln in trailer_suitability
-- nachschauen, bei Treffer Nr. 30 abbrechen -- im Schnitt ~1.800-2.600
-- Einzel-Lookups. Bei warmem Cache <100ms, bei kaltem Cache (Produktion,
-- Netzwerk-Storage) gemessen 3,5-6,6s je nach Sortierung -- ueber dem
-- 8s-statement_timeout der PostgREST-authenticator-Rolle.
--
-- Fix: fuer p_verdict='checked' wird core.charge_point NICHT mehr in
-- Sortierreihenfolge gescannt, sondern zuerst per idx_ts_verdict auf die
-- ~2.245 tatsaechlich "geprueften" charge_point_key eingegrenzt
-- ("with ... as materialized" verhindert, dass der Planer diese CTE wieder
-- in den alten Plan zurueckfaltet -- ohne materialized wurde exakt das
-- getestet und der alte, schlechte Plan kam trotzdem zurueck). Danach erst
-- Join + Sortierung + LIMIT auf dieser kleinen, garantiert beschraenkten
-- Menge -- Kosten damit unabhaengig von Cache-Zustand und Sortierung.
-- Gemessen (EXPLAIN ANALYZE auf Produktion): 432ms statt 3,5-6,6s.
--
-- p_verdict='unchecked' (>98% aller Zeilen, 135.531 von 137.776) bleibt
-- bewusst beim bisherigen LEFT-JOIN-Ansatz -- dort ist der fruehe Abbruch
-- beim Scannen in Sortierreihenfolge weiterhin die guenstigere Strategie
-- (fast jede Zeile matcht ohnehin).
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
    v_cte text := '';
    v_from text;
    v_sql text;
    v_explain jsonb;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    -- p_verdict ist hier bewusst NICHT mehr Teil von v_where -- siehe unten
    -- (v_cte/v_from), verdict-Filterung passiert jetzt je nach Wert ueber
    -- eine eigene Query-Struktur statt einer generischen OR-Bedingung.
    v_where := $where$
        ($1 is null or cp.name ilike '%' || $1 || '%' or cp.operator ilike '%' || $1 || '%')
        and ($2 is null or cp.city ilike '%' || $2 || '%')
        and ($3 is null or cp.country_code = $3::bpchar)
        and ($4 is null or cp.operator = $4)
        and ($5 is null or cp.max_power_kw >= $5)
    $where$;

    if p_verdict = 'checked' then
        v_cte := $cte$
            with checked_keys as materialized (
                select charge_point_key from enrich.trailer_suitability
                where verdict in ('no', 'yes', 'unhitch')
            )
        $cte$;
        v_from := $from$
            core.charge_point cp
            join checked_keys ck on ck.charge_point_key = cp.external_key
            left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
        $from$;
    else
        v_from := 'core.charge_point cp left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key';
        if p_verdict = 'unchecked' then
            v_where := v_where || $unchecked$ and coalesce(ts.verdict, 'unknown') = 'unknown'$unchecked$;
        end if;
    end if;

    execute format(
        '%s explain (format json) select 1 from %s where %s',
        v_cte, v_from, v_where
    ) into v_explain using p_q, p_city, p_country_code, p_operator, p_min_power_kw;
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
         limit $6 offset $7',
        v_cte, v_total, v_from, v_where, v_order_col, v_order_dir
    );

    if p_q is not null then
        set local enable_indexscan = off;
    end if;

    return query execute v_sql using p_q, p_city, p_country_code, p_operator, p_min_power_kw, p_limit, p_offset;
end;
$$;

comment on function core.charge_point_admin_list(text, text, text, text, numeric, text, integer, integer, text) is
  'Fuer /ladestationen (admin). total_count kommt aus der Planer-Zeilenschaetzung (EXPLAIN FORMAT JSON) statt echtem COUNT(*). country_code wird als bpchar verglichen (Cast auf den Parameter, nicht die Spalte). Bei aktiver Textsuche (p_q) erzwingt "set local enable_indexscan = off" den Bitmap-Scan ueber idx_cp_name_trgm/idx_cp_operator_trgm (20261022080000) statt des sonst gewaehlten, bei breiten Treffern langsameren und cache-abhaengigen Index-Order-Scans (20261022090000). p_verdict=''checked'' filtert ueber eine materialisierte CTE auf idx_ts_verdict vor (20261024120000) statt eines LEFT-JOIN-Scans in Sortierreihenfolge -- bei nur ~1,6% Trefferquote war Letzteres bei kaltem Cache ueber dem 8s-PostgREST-Timeout. SET LOCAL gilt nur fuer die aktuelle Transaktion/den aktuellen RPC-Aufruf.';
