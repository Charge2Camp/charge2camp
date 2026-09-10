import { FullscreenLoader } from "@/components/fullscreen-loader";

// Next.js-Suspense-Fallback (app/loading.tsx, siehe node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md):
// greift automatisch beim App-Start und bei jedem Seitenwechsel ohne
// spezifischeres loading.tsx in einem Unterordner -- verschwindet erst,
// wenn die Ziel-Seite (page.tsx) mit allen Server-Daten fertig gerendert
// ist (Nutzerwunsch: kein vorzeitiges Verschwinden vor vollstaendigem
// Laden). Fuer Bereiche mit eigenem, praeziserem Text (z. B. "Ladepunkte
// werden geladen") existiert je ein spezifischeres loading.tsx im
// jeweiligen Routenordner.
export default function Loading() {
  return <FullscreenLoader text="charge2camp wird geladen…" />;
}
