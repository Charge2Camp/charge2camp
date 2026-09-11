-- Die urspruengliche "profiles are updatable by their owner"-Policy
-- (20260904210000_init_schema.sql) hatte kein WITH CHECK und erlaubte
-- damit einem eingeloggten Nutzer, per normalem Update JEDE Spalte der
-- eigenen Zeile zu aendern -- inklusive is_admin. Ein Nutzer konnte sich
-- so selbst zum Admin machen.
--
-- is_admin darf ab jetzt nur noch ueber den Service-Role-Client des
-- eigenstaendigen Admin-Backends geaendert werden (admin/app/(dashboard)/
-- nutzer/[id]/actions.ts, setIsAdmin) -- der Service-Role-Key umgeht RLS
-- komplett und ist von dieser Policy nicht betroffen. Alle anderen
-- eigenen Profilfelder (home_address, default_vehicle_id, ...) bleiben
-- wie bisher direkt vom Nutzer aenderbar.
drop policy "profiles are updatable by their owner" on public.profiles;

create policy "profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  );
