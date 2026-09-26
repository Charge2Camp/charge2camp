import type { HTMLAttributes } from "react";

/** §14 des Design-Briefs -- s. button.tsx fuer den Kontext. `border-line`
 * statt hartcodiertem `border-black/10` (docs/DESIGN_DECISIONS.md,
 * "Grosse border-black/10-Aufraeumrunde" -- fast alle Bestandsstellen
 * inzwischen mitmigriert). Radien `rounded-md`/`rounded-lg` (6px/8px)
 * entsprechen seit der Korrektur in docs/design/brand-guide.md/
 * tokens.json (Phase 16) dem tatsaechlich gelebten Wert -- vorher
 * dokumentierte 10px/12px waren nie umgesetzt. */

export type CardVariant = "default" | "emphasis" | "tint-route" | "tint-warning";

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: "rounded-md border border-line p-3",
  emphasis: "rounded-lg border border-line p-4",
  // Getoente Hinweisflaechen (brand-guide.md §3 "--c-tint-trailer"-Prinzip
  // auf Route/Warning uebertragen): eigene Rolle, Text traegt bereits die
  // Farbe mit, kein zusaetzliches Icon noetig fuer diesen Kartentyp.
  "tint-route": "rounded-lg border border-route/30 bg-route/5 p-4 text-sm font-medium text-route",
  "tint-warning": "rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning-text",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export function Card({ variant = "default", className = "", ...props }: CardProps) {
  return <div className={`${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}
