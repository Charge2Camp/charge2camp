"use client";

import { useActionState } from "react";
import { bulkUpdateChargePoints, type BulkUploadResult } from "./actions";

const INITIAL_STATE: BulkUploadResult = { ok: true, totalRows: 0, coreUpdated: 0, trailerUpdated: 0, issues: [] };

export function UploadForm() {
  const [result, formAction, pending] = useActionState(bulkUpdateChargePoints, INITIAL_STATE);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          CSV-Datei
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-action file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover disabled:opacity-50"
        >
          {pending ? "Wird verarbeitet…" : "Hochladen"}
        </button>
      </form>

      {!result.ok && result.error && (
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-3 text-sm text-status-down">
          {result.error}
        </p>
      )}

      {result.ok && result.totalRows > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-card p-4 text-sm">
          <p className="font-medium">
            {result.totalRows} Zeile{result.totalRows === 1 ? "" : "n"} verarbeitet -- {result.coreUpdated}× Stammdaten
            aktualisiert, {result.trailerUpdated}× Anhängertauglichkeit aktualisiert.
          </p>
          {result.issues.length > 0 && (
            <div>
              <p className="font-medium text-status-busy">{result.issues.length} Hinweis(e):</p>
              <ul className="mt-1 flex flex-col gap-1 text-text-muted">
                {result.issues.map((issue, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{issue.external_key}</span>: {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
