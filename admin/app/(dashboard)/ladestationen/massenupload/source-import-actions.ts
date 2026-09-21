"use server";

import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";

/** Muss exakt zu den Dateinamen ingest/import_<source>.py UND zum
 * `source`-Choice-Input in .github/workflows/source-import.yml passen --
 * eine neue Quelle braucht alle drei Stellen synchron. */
export const SOURCE_IDS = ["bnetza", "irve", "ripree"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

const STORAGE_BUCKET = "source-imports";

function assertValidSource(source: string): asserts source is SourceId {
  if (!SOURCE_IDS.includes(source as SourceId)) {
    throw new Error(`Unbekannte Quelle "${source}".`);
  }
}

/** Erzeugt eine zeitlich begrenzte Upload-URL, in die der Browser die
 * CSV-Datei DIREKT hochlaedt (kein Umweg ueber eine Vercel-Function --
 * 40-160 MB grosse Dateien wuerden dort am Payload-/Timeout-Limit
 * scheitern, siehe Plan-Kontext). Der zurueckgegebene `path` wird dem
 * GitHub-Actions-Workflow als Input mitgegeben (triggerSourceImport()). */
export async function createSourceUploadUrl(source: string, fileName: string) {
  await requireAdmin();
  assertValidSource(source);

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${source}/${Date.now()}-${safeFileName}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Signierte Upload-URL konnte nicht erzeugt werden: ${error.message}`);

  return { signedUrl: data.signedUrl, token: data.token, path };
}

/** Loest per GitHub REST API den source-import.yml-Workflow aus (siehe
 * .github/workflows/source-import.yml) -- der laeuft ausserhalb von Vercel
 * und uebernimmt die eigentliche, lange Importarbeit. Braucht
 * GITHUB_DISPATCH_TOKEN (Fine-grained PAT, Scope "Actions: Read and write"
 * auf Charge2Camp/charge2camp) als Vercel-Env-Var -- muss der Nutzer selbst
 * im Vercel-Projekt hinterlegen, siehe docs/data-sources.md. */
export async function triggerSourceImport(source: string, storagePath: string) {
  await requireAdmin();
  assertValidSource(source);

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_DISPATCH_TOKEN ist nicht konfiguriert -- der Import-Workflow kann nicht ausgeloest werden. " +
        "Siehe docs/data-sources.md, Abschnitt 'Admin-Upload (GitHub Actions)'."
    );
  }

  const response = await fetch(
    "https://api.github.com/repos/Charge2Camp/charge2camp/actions/workflows/source-import.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "development",
        inputs: { source, storage_path: storagePath },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub-Workflow konnte nicht ausgeloest werden (${response.status}): ${body}`);
  }
}
