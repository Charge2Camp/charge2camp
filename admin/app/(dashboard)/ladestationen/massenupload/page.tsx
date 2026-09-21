import Link from "next/link";
import { UploadForm } from "./upload-form";
import { SourceImportForm } from "./source-import-form";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import type { SourceId } from "./source-import-config";

interface LastImportRow {
  scope: string;
  status: string;
  record_count: number | null;
  finished_at: string | null;
  started_at: string;
}

// Reihenfolge = Anzeigereihenfolge. downloadUrl zeigt bewusst auf die
// jeweilige Uebersichtsseite, nicht auf die Datei selbst -- Dateinamen/
// -pfade aendern sich mit jeder neuen Version (z. B. traegt die BNetzA-CSV
// das Exportdatum im Dateinamen), ein direkter Datei-Link wuerde veralten.
// dbSourceId: core.source_registry/core.charge_point.source verwenden fuer
// BNetzA den vollen Namen "bundesnetzagentur" (siehe supabase/migrations/
// 20261012000000_field_provenance_and_source_registry.sql), waehrend
// SourceId/SOURCE_IDS ueberall sonst (Dateiname ingest/import_bnetza.py,
// GitHub-Workflow-Input) bewusst die kurze Form "bnetza" nutzt -- deshalb
// hier eine eigene Abbildung fuer den Status-RPC-Aufruf statt id direkt zu
// verwenden.
const SOURCES: { id: SourceId; dbSourceId: string; label: string; downloadUrl: string }[] = [
  {
    id: "bnetza",
    dbSourceId: "bundesnetzagentur",
    label: "Deutschland -- Bundesnetzagentur Ladesäulenregister",
    downloadUrl: "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/start.html",
  },
  {
    id: "irve",
    dbSourceId: "irve",
    label: "Frankreich -- Base Nationale des IRVE",
    downloadUrl:
      "https://transport.data.gouv.fr/datasets/base-nationale-des-irve-data-gouv-infrastructures-de-recharge-pour-vehicules-electriques-donnees-statiques",
  },
  {
    id: "ripree",
    dbSourceId: "ripree",
    label: "Spanien -- RIPREE (MITECO)",
    downloadUrl: "https://energia.serviciosmin.gob.es/Ripree/ExportarInstalaciones/Export",
  },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export default async function BulkUploadPage() {
  await requireAdmin();
  const supabase = createServiceClient();

  const lastImports = await Promise.all(
    SOURCES.map(async (s) => {
      const { data } = await supabase.schema("core").rpc("last_import", { p_source: s.dbSourceId });
      return (data?.[0] as LastImportRow | undefined) ?? null;
    })
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Massenupload Ladestationen</h1>
        <p className="mt-1 text-sm text-text-muted">
          Stammdaten und Anhängertauglichkeit für viele Ladestationen auf einmal per CSV-Datei anpassen -- Zeilen
          werden über die <span className="font-mono">external_key</span> zugeordnet (dieselbe ID, die auch auf der
          jeweiligen Ladestations-Detailseite steht). Leere Zellen bleiben unverändert -- es müssen also nur die
          Spalten ausgefüllt werden, die sich tatsächlich ändern sollen.
        </p>
      </div>

      <Link
        href="/ladestationen/massenupload/vorlage"
        className="inline-flex min-h-11 w-fit items-center rounded-md border border-line px-4 text-sm font-medium hover:bg-line/20"
      >
        Vorlage herunterladen (CSV)
      </Link>

      <UploadForm />

      <div className="border-t border-line pt-6">
        <h2 className="text-lg font-semibold">Quellenimport (nationale Register)</h2>
        <p className="mt-1 text-sm text-text-muted">
          Rohdatei einer nationalen Quelle hochladen, sobald eine neue Version verfügbar ist -- die eigentliche
          Verarbeitung (Minuten bis mehrere Stunden) läuft im Hintergrund über GitHub Actions, nicht in dieser
          Seite. Feldpriorität, Provenance und Schutz manuell korrigierter Stationen laufen automatisch über den
          zentralen Resolver (siehe docs/data-sources.md).
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {SOURCES.map((s, i) => {
            const last = lastImports[i];
            return (
              <div key={s.id} className="rounded-md border border-line bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{s.label}</p>
                  <a
                    href={s.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-action hover:underline"
                  >
                    Aktuelle Datei herunterladen ↗
                  </a>
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  Letzter Import:{" "}
                  {last ? (
                    <>
                      <span className="font-medium">{formatDateTime(last.finished_at)}</span>
                      {last.status !== "ok" && <span className="text-status-down"> ({last.status})</span>}
                      {typeof last.record_count === "number" && ` · ${last.record_count} Ladepunkte`}
                    </>
                  ) : (
                    "noch nie importiert"
                  )}
                </p>
                <div className="mt-3">
                  <SourceImportForm source={s.id} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
