"use client";

import { useState, type ReactNode } from "react";

/** Haelt ein "Neu hinzufuegen"-Formular standardmaessig eingeklappt hinter
 * einem Button, sobald schon Eintraege existieren -- vorher stand z. B.
 * das komplette Fahrzeug-Formular (7+ Felder) auf /profil/gespann IMMER
 * unter der Liste, auch wenn man nur sein bestehendes Fahrzeug ansehen
 * wollte (siehe Design-Review). Bei leerer Liste bleibt es offen, damit
 * neue Nutzer sofort das Formular sehen statt erst einen Button suchen zu
 * muessen. */
export function CollapsibleFormSection({
  children,
  addLabel,
  defaultOpen,
}: {
  children: ReactNode;
  addLabel: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex min-h-11 items-center gap-2 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        + {addLabel}
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">{addLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center px-2 text-sm text-black/50 hover:underline dark:text-white/50"
        >
          Abbrechen
        </button>
      </div>
      {children}
    </div>
  );
}
