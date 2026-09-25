-- Nutzervorgabe (2026-09-25, wiederholt aus 2026-09-22): "immer noch viel
-- zu viele Dubletten fuer ein manuelles Pruefen -- alle 100% aehnliche
-- Adresse sinnvoll zusammenfuehren". Root Cause: core.
-- merge_exact_address_duplicates() (20261024090000) wurde damals bewusst
-- als "einmalige/manuell ausloesbare Ergaenzung" gebaut und lief genau
-- EIN Mal (limit 500, 182 Treffer) -- anders als core.
-- auto_merge_bnetza_over_manual_duplicates() (20261024020000, dieselbe
-- Sitzung) wurde sie NICHT in core.refresh_all_quality_data() eingehaengt.
-- Seitdem erzeugt jeder Reimport (core.refresh_charge_point_duplicates()
-- laeuft naechtlich) neue Kandidatenpaare mit exakter normalisierter
-- Adressuebereinstimmung, die tier9_exact_address NICHT erfasst (exakter
-- Stadt-String-Vergleich, siehe 20261024090000-Kommentar: "Frankfurt am
-- Main" vs. "Frankfurt" usw.) oder die eine manual_override-Seite ausserhalb
-- der engen BNetzA-vs-manual-Regel betreffen -- diese blieben seit dem
-- 2026-09-22-Lauf komplett unbearbeitet liegen, daher der erneut wachsende
-- manuelle Warteschlangenbestand.
--
-- Fix: gleiches Muster wie der BNetzA-Nachlauf in 20261024020000 --
-- (1) core.merge_exact_address_duplicates() dauerhaft in
-- refresh_all_quality_data() einhaengen (limit 500 je Nachtlauf, analog zu
-- auto_merge_bnetza_over_manual_duplicates(500) dort), (2) einmaliger
-- Nachlauf ueber den seit dem letzten Aufruf aufgelaufenen Rueckstau mit
-- grosszuegigem Limit.
create or replace function core.refresh_all_quality_data()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if not pg_try_advisory_xact_lock(hashtext('core.refresh_all_quality_data')) then
        raise notice 'core.refresh_all_quality_data() laeuft bereits -- uebersprungen.';
        return;
    end if;
    perform core.refresh_charge_point_duplicates();
    perform core.auto_merge_all_charge_point_duplicates();
    perform core.auto_merge_bnetza_over_manual_duplicates(500);
    perform core.merge_exact_address_duplicates(500);
    perform core.refresh_quality_checks();
end;
$$;

-- Nachlauf ueber den seit 2026-09-22 aufgelaufenen Rueckstau -- Limit weit
-- ueber der damaligen Fundmenge (182), damit auch ein groesserer
-- Rueckstau in einem Lauf erledigt wird. security definer, daher ohne
-- expliziten Admin-Aufrufer hier zulaessig (Migrationen laufen als
-- Owner-Rolle).
select * from core.merge_exact_address_duplicates(5000);
