// PostToolUse (Edit|Write|MultiEdit): Typecheck + ESLint + Design-Token-Check.
// Exit 2 = Befund geht per stderr zurueck an Claude.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const ti = input.tool_input ?? {};
const file = String(ti.file_path ?? "").split(String.fromCharCode(92)).join("/");
const root = String(input.cwd ?? process.cwd());

if (!/\/src\/.*\.(ts|tsx)$/.test(file)) process.exit(0);

const problems = [];
const run = (label, args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(0, 30).join("\n");
    problems.push(`${label}:\n${out}`);
  }
};

run("tsc --noEmit", ["node_modules/typescript/bin/tsc", "--noEmit"]);
run("eslint", ["node_modules/eslint/bin/eslint.js", file]);

// Design-System (CLAUDE.md Prinzip 9): keine hart codierten Farben. Nur der neu
// geschriebene Text wird geprueft, damit Altbestand nicht bei jeder Edit nervt.
if (file.endsWith(".tsx")) {
  const added = [ti.new_string, ti.content, ...(ti.edits ?? []).map((e) => e.new_string)]
    .filter(Boolean)
    .join("\n");
  const re =
    /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}|(?:black|white)\/\d+)(?:\/\d+)?\b|#[0-9a-fA-F]{6}\b/g;
  const hits = [...new Set(added.match(re) ?? [])];
  if (hits.length)
    problems.push(
      `Hart codierte Farben (${hits.join(", ")}). Design-Token aus src/app/globals.css / docs/design/tokens.json verwenden (z.B. text-error, text-text-muted, border-line-strong) oder neuen Token ergaenzen.`,
    );
}

if (problems.length) {
  console.error(problems.join("\n\n"));
  process.exit(2);
}
