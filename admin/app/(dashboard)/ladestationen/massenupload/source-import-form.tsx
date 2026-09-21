"use client";

import { useState } from "react";
import { createSourceUploadUrl, triggerSourceImport, type SourceId } from "./source-import-actions";

interface Props {
  source: SourceId;
}

type Phase = "idle" | "uploading" | "starting" | "done" | "error";

export function SourceImportForm({ source }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPhase("uploading");
    setMessage(null);
    try {
      const { signedUrl, path } = await createSourceUploadUrl(source, file.name);

      // Direkt aus dem Browser in Supabase Storage hochladen -- laeuft NICHT
      // durch eine Vercel-Function (siehe source-import-actions.ts,
      // 40-160 MB grosse Dateien wuerden dort scheitern).
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/csv" },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload fehlgeschlagen (${uploadResponse.status}).`);
      }

      setPhase("starting");
      await triggerSourceImport(source, path);

      setPhase("done");
      setMessage(
        "Import gestartet. Das kann je nach Quelle Minuten bis mehrere Stunden dauern -- der Status oben " +
          "aktualisiert sich automatisch, sobald der Lauf abgeschlossen ist (Seite neu laden)."
      );
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Unbekannter Fehler beim Hochladen.");
    }
  }

  const busy = phase === "uploading" || phase === "starting";

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="sr-only">CSV-Datei für {source}</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
          className="min-h-11 rounded-md border border-line px-3 py-2 text-base file:mr-3 file:rounded-md file:border-0 file:bg-action file:px-3 file:py-2 file:text-sm file:font-medium disabled:opacity-50"
        />
      </label>
      {phase === "uploading" && <p className="text-sm text-text-muted">Lädt hoch…</p>}
      {phase === "starting" && <p className="text-sm text-text-muted">Startet den Import…</p>}
      {phase === "done" && <p className="rounded-md border border-route/40 bg-route/10 p-2 text-sm text-route">{message}</p>}
      {phase === "error" && (
        <p className="rounded-md border border-status-down/40 bg-status-down/5 p-2 text-sm text-status-down">{message}</p>
      )}
    </div>
  );
}
