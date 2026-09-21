-- Storage-Bucket fuer den Admin-Upload nationaler Quellen-CSVs
-- (BNetzA/IRVE/RIPREE), siehe admin/app/(dashboard)/ladestationen/
-- massenupload/source-import-actions.ts und
-- .github/workflows/source-import.yml.
--
-- Bewusst PRIVAT und OHNE eigene RLS-Policies: jeder Zugriff (signierte
-- Upload-URL-Erzeugung im Admin-Backend, Download+Loeschen im GitHub-
-- Actions-Workflow) laeuft ausschliesslich ueber den Service-Role-Key, der
-- RLS grundsaetzlich umgeht -- gleiches Prinzip wie core/enrich in diesem
-- Projekt (siehe z. B. Kommentare in supabase/migrations/
-- 20260927000000_security_hardening_admin_rpcs.sql). Kein anon/
-- authenticated Client greift je direkt auf diesen Bucket zu.
insert into storage.buckets (id, name, public)
values ('source-imports', 'source-imports', false)
on conflict (id) do nothing;
