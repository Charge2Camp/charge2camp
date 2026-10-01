// PreToolUse (Edit|Write|MultiEdit): schuetzt sensible Dateien und warnt bei
// Funktions-Signatur-Fallen in Migrationen.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ti = input.tool_input ?? {};
const file = String(ti.file_path ?? "").split(String.fromCharCode(92)).join("/");

const deny = (msg) => {
  console.error(msg);
  process.exit(2);
};

if (/\/\.env(\.[^/]*)?$/.test(file) && !file.endsWith(".env.example"))
  deny("Env-Dateien mit Secrets (.env*, ausser .env.example) werden nicht von Claude bearbeitet. Bitte manuell aendern.");
if (file.endsWith("/package-lock.json"))
  deny("package-lock.json nicht direkt editieren - per npm install/update aendern.");

if (/\/supabase\/migrations\/.*\.sql$/.test(file)) {
  const text = [ti.new_string, ti.content, ...(ti.edits ?? []).map((e) => e.new_string)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const creates = [...text.matchAll(/create\s+or\s+replace\s+function\s+([\w."]+)/g)].map((m) => m[1]);
  const flat = text.split(/\s+/).join(" ");
  const missing = creates.filter(
    (name) => !flat.includes(`drop function if exists ${name}(`) && !flat.includes(`drop function if exists ${name} (`),
  );
  if (missing.length) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `CREATE OR REPLACE FUNCTION ${missing.join(", ")} ohne vorheriges DROP FUNCTION IF EXISTS. Aendert die Migration die Parameterliste, entsteht ein doppelter Overload ("function ... is not unique"). Nur bestaetigen, wenn die Signatur unveraendert bleibt.`,
        },
      }),
    );
  }
}
