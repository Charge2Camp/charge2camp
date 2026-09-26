import type { ReactNode } from "react";

/** UX-07.1 (docs/design/ux-problems.md): Formularfehler zeigten bisher
 * nur die Fehlerfarbe (--c-error), ohne begleitendes Symbol --
 * verstoesst gegen brand-guide.md §9 ("Farbe nie als einziger
 * Informationstraeger") und ist bei Farbsehschwaeche schwerer von
 * normalem Text zu unterscheiden. Zentrale, wiederverwendete
 * Komponente statt an jeder der ~26 Stellen im Code einzeln ein Symbol
 * zu ergaenzen. `className` steuert Textgroesse/Abstand (bisher text-sm
 * oder text-xs, teils mit mt-1/mt-2/w-full je nach Kontext). */
export function FormError({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-error ${className}`}>
      <span aria-hidden="true" className="shrink-0 leading-none">
        ⚠
      </span>
      <span>{children}</span>
    </p>
  );
}
