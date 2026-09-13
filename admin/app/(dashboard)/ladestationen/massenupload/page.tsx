import Link from "next/link";
import { UploadForm } from "./upload-form";

export default function BulkUploadPage() {
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
    </div>
  );
}
