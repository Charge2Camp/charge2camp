// PostToolUse (Edit|Write|MultiEdit): faengt Server-only-Wert-Imports in "use client"-Code ab.
// Ein solcher Import (next/headers, supabase/server|admin|service, "server-only") laesst die ganze App
// mit 500 abstuerzen; tsc/eslint erkennen das nicht. Exit 2 = Befund geht per stderr an Claude.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { projectFor, readHookInput, slash } from "./project.mjs";

const { file, root } = readHookInput(readFileSync(0, "utf8"));
const project = projectFor(file, root);
if (!project) process.exit(0);

const directive = (src, name) =>
  new RegExp(String.raw`^\s*(?:(?://[^\n]*\n|/\*[\s\S]*?\*/)\s*)*['"]${name}['"]`).test(src);
const IMPORT_RE = /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;

const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

const resolveSpec = (spec, from) => {
  const base = spec.startsWith("@/") ? join(project.aliasBase, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return slash(c);
  }
  return null;
};

// Wert-Imports einer Datei (ohne `import type` und ohne rein typisierte Specifier).
const valueImports = (src) => {
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const [, isType, clause, spec, bare] = m;
    if (isType) continue;
    if (clause && /^\{[^}]*\}$/.test(clause.trim())) {
      const names = clause.trim().slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length && names.every((n) => n.startsWith("type "))) continue;
    }
    out.push(spec ?? bare);
  }
  return out;
};

const src = read(file);
if (src === null || !directive(src, "use client")) process.exit(0);

// Tiefensuche ueber Wert-Imports; "use server"-Dateien (Server Actions) sind eine sichere Grenze.
const seen = new Set([file]);
const findings = [];
const walk = (path, chain) => {
  const s = read(path);
  if (s === null) return;
  if (path !== file && directive(s, "use server")) return;
  const specs = valueImports(s);
  if (specs.some((x) => project.serverSpec.test(x))) {
    findings.push(chain.concat(path).map((p) => p.replace(`${slash(root)}/`, "")).join(" -> "));
    return;
  }
  for (const spec of specs) {
    const target = resolveSpec(spec, path);
    if (target && !seen.has(target)) {
      seen.add(target);
      walk(target, chain.concat(path));
    }
  }
};
walk(file, []);


if (findings.length) {
  console.error(
    `Client/Server-Grenze verletzt: "use client"-Code zieht Server-only-Code per Wert-Import nach (legt die App mit 500 lahm):\n- ${findings.join("\n- ")}\n` +
      `Loesung: Server-Teil in eine "use server"-Action oder Server Component auslagern, nur \`import type\` aus Server-Dateien nutzen oder die Logik in eine neutrale lib-Datei ohne Server-Imports verschieben.`,
  );
  process.exit(2);
}
