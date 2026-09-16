-- Rate-Limiting fuer die eigenen (jetzt Login-pflichtigen, siehe
-- Next.js-Aenderungen) Lese-Endpunkte fuer Ladepunkte/Campingplaetze --
-- ohne Limit liesse sich der Datensatz weiterhin ueber viele kleine,
-- aber technisch legitime Anfragen (z. B. Bounding-Box-Iteration)
-- zusammenscrapen, selbst mit Login. Bewusst Postgres-basiert auf der
-- ohnehin vorhandenen Supabase-Instanz statt eines neuen Providers wie
-- Upstash/Redis (Kostenoptimierung, siehe CLAUDE.md Prinzip 4).
--
-- Kein anon-/authenticated-Grant noetig: wird ausschliesslich ueber den
-- Service-Role-Client (createAdminClient()) aus den Next.js-Route-Handlern
-- aufgerufen, analog core.charge_point_geo_admin (nur service_role).
create table core.rate_limit_bucket (
    key text primary key,
    window_start timestamptz not null default now(),
    request_count int not null default 1
);

revoke all on core.rate_limit_bucket from anon, authenticated;

-- Atomarer Fixed-Window-Zaehler per INSERT ... ON CONFLICT (vermeidet die
-- Race Condition eines Read-then-Write aus der Next.js-Route heraus).
-- Ist das Fenster abgelaufen, wird der Zaehler auf 1 zurueckgesetzt,
-- sonst hochgezaehlt; das Ergebnis (<= max) entscheidet ueber "erlaubt".
create or replace function core.check_rate_limit(p_key text, p_window_seconds int, p_max_requests int)
returns boolean
language plpgsql
security definer
set search_path = core, pg_temp
as $$
declare
    v_allowed boolean;
begin
    insert into core.rate_limit_bucket (key, window_start, request_count)
    values (p_key, now(), 1)
    on conflict (key) do update
        set request_count = case
                when core.rate_limit_bucket.window_start < now() - make_interval(secs => p_window_seconds)
                    then 1
                else core.rate_limit_bucket.request_count + 1
            end,
            window_start = case
                when core.rate_limit_bucket.window_start < now() - make_interval(secs => p_window_seconds)
                    then now()
                else core.rate_limit_bucket.window_start
            end
    returning (request_count <= p_max_requests) into v_allowed;

    return v_allowed;
end;
$$;

grant execute on function core.check_rate_limit(text, int, int) to service_role;
