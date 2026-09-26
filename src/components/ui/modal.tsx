"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** §14 des Design-Briefs -- s. button.tsx fuer den Kontext. Fasst das
 * Wrapper-Markup zusammen, das bislang in mehreren Dialogen identisch
 * dupliziert war (Sheet auf Mobile, zentriertes Panel ab `sm:`, Kopfzeile
 * mit Titel + Schliessen-Button, scrollbarer Inhaltsbereich). Nutzt
 * `bg-card`/`border-line` statt der im Ursprungscode hartcodierten
 * `bg-white dark:bg-neutral-900`/`border-black/10`.
 *
 * Bewusst NICHT fuer jeden Dialog verwendet: `nearby-charging-modal.tsx`
 * braucht eine abweichende, feste Hoehe (Kartenausschnitt), die mit der
 * hier fest verdrahteten `sm:h-auto`-Annahme kollidieren wuerde -- dort
 * bleibt das Wrapper-Markup bewusst eigenstaendig. */
export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  size?: ModalSize;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div
        className={`flex h-full w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[85vh] sm:w-full sm:rounded-lg ${SIZE_CLASSES[size]}`}
      >
        <div className="flex items-center justify-between border-b border-line p-4 pt-[calc(1rem+var(--safe-top))] sm:pt-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">{children}</div>
      </div>
    </div>
  );
}
