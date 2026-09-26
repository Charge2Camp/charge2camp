import type { HTMLAttributes } from "react";

/** §14 des Design-Briefs -- s. button.tsx fuer den Kontext. Deckt die
 * generischen, noch nicht komponentisierten Badge-Muster ab (neutrale
 * Labels, gefuellte Zaehl-Badges). Fuer Anhaengertauglichkeits-Pins gilt
 * weiterhin TRAILER_PIN_COLORS/_LABELS/_TEXT_CLASS (src/lib/
 * trailer-verdict.ts) und fuer die Herkunfts-Vertrauensstufe
 * ReviewStateBadge -- beide haben eigene, bereits etablierte Farblogik
 * und werden hier bewusst nicht ersetzt (§3 brand-guide.md: "Jede Farbe
 * hat genau eine Rolle", eine generische Badge-Farbe waere die falsche
 * Abstraktion fuer eine Domaenen-Semantik mit fuenf/drei festen
 * Zustaenden). */

export type BadgeVariant = "outline" | "filled" | "route" | "error";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  outline: "rounded-full border border-line px-2 py-0.5 text-xs",
  filled: "rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10",
  route: "rounded bg-route/10 px-2 py-0.5 text-xs text-route",
  error: "rounded bg-error/10 px-2 py-0.5 text-xs text-error",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "outline", className = "", ...props }: BadgeProps) {
  return <span className={`${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}
