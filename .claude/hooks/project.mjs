// Gemeinsame Hook-Hilfe: ordnet eine bearbeitete Datei der Haupt-App (src/) oder dem
// eigenstaendigen Admin-Projekt (admin/) zu. Beide haben eigenes tsconfig, node_modules
// und eigenen "@/"-Alias. null = Datei gehoert zu keinem geprueften TS-Projekt.
const slash = (p) => String(p).split(String.fromCharCode(92)).join("/");

export const readHookInput = (raw) => {
  const input = JSON.parse(raw);
  const ti = input.tool_input ?? {};
  return { ti, file: slash(ti.file_path ?? ""), root: slash(input.cwd ?? process.cwd()) };
};

export const projectFor = (file, root) => {
  if (!/\.(ts|tsx)$/.test(file)) return null;
  // Laufwerksbuchstaben/Gross-Klein koennen zwischen cwd und file_path abweichen (Windows).
  const f = file.toLowerCase();
  const r = root.toLowerCase();
  if (f.startsWith(`${r}/admin/`)) {
    if (f.includes("/node_modules/")) return null;
    return {
      name: "admin",
      dir: `${root}/admin`,
      aliasBase: `${root}/admin`,
      serverSpec: /^(?:server-only|next\/headers|@\/lib\/supabase\/(?:server|service))$/,
    };
  }
  if (f.startsWith(`${r}/src/`)) {
    return {
      name: "app",
      dir: root,
      aliasBase: `${root}/src`,
      serverSpec: /^(?:server-only|next\/headers|@\/lib\/supabase\/(?:server|admin))$/,
    };
  }
  return null;
};

export { slash };
