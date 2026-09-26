import type { ReactNode } from "react";

/** Grenzt einen Inhaltsabschnitt visuell als eigene Karte ab -- nur fuers
 * Bottom-Sheet der mobilen Kartenansicht gedacht (station-bottom-sheet.tsx),
 * NICHT fuer die freistehenden Kind-Komponenten selbst (StationTechnicalDetails
 * etc.) uebernommen, da dieselben Komponenten unveraendert auch auf der
 * eigenstaendigen Detailseite (ladepunkte/[id]/page.tsx) verwendet werden.
 *
 * Orientiert an evcaravan.de/ABRP-Vergleich (Nutzerwunsch): mehrere klar
 * abgegrenzte Karten statt durchlaufender Abschnitte wirken uebersichtlicher
 * beim schnellen Scrollen. `bg-surface` auf dem `bg-card`-Sheet, da das die
 * einzigen zwei Flaechentoene des Design-Systems sind (docs/design/tokens.json)
 * -- der Helligkeitsunterschied ist subtil, deshalb zusaetzlich `border-line`
 * als eindeutige Abgrenzung. */
export function SectionCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface p-4">{children}</div>;
}
