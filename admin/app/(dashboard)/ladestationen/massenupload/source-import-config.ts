/** Kein "use server" hier -- eine "use server"-Datei darf ausschliesslich
 * async Funktionen exportieren (siehe source-import-actions.ts), Konstanten/
 * Typen muessen deshalb in einer separaten Datei stehen. */
export const SOURCE_IDS = ["bnetza", "irve", "ripree"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
