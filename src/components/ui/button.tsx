import type { ButtonHTMLAttributes } from "react";

/** §14 des Design-Briefs (docs/design/DESIGN_DECISIONS.md, "Formale
 * UI-Komponentenbibliothek: Button/Card/Badge/Input") -- erster Schritt
 * der bisher fehlenden Komponentenbibliothek. Fasst die bereits
 * konsistent wiederkehrenden Button-Muster zusammen (bisher an jeder
 * der ~50 Stellen im Code einzeln als Tailwind-Klassenkette
 * geschrieben), statt neue Varianten zu erfinden. Farben/Radien/
 * Tap-Ziele kommen ausschliesslich aus bestehenden Tokens
 * (docs/design/tokens.json) -- kein neuer visueller Stil. */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "destructive-outline"
  | "route-outline"
  | "plain"
  | "ghost";
export type ButtonSize = "sm" | "md" | "link";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action font-medium text-base hover:bg-action-hover disabled:opacity-50",
  secondary: "border border-line-strong font-medium hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10",
  destructive: "bg-error font-medium text-white hover:bg-error/90 disabled:opacity-50",
  "destructive-outline": "border border-error/30 font-medium text-error hover:bg-error/10 disabled:opacity-50",
  // "route-outline": positive/bestaetigende Alternativ-Aktion neben einem
  // primaeren Button (z. B. "Als Start verwenden" neben "Als Ziel
  // verwenden") -- 2 Fundstellen mit identischer Klassenkette.
  "route-outline": "border border-route font-medium text-route hover:bg-route/10 disabled:opacity-50",
  // "plain": textbasierte Buttons ohne eigene Hintergrund-/Rahmenfarbe (z. B.
  // "Bearbeiten", "Löschen" als Link-Stil) -- Textfarbe kommt bewusst nicht
  // aus dieser Komponente (variiert je Kontext: text-error, text-route,
  // text-text-muted), sondern aus der uebergebenen className des Aufrufers.
  plain: "font-medium hover:underline disabled:opacity-50",
  // "ghost": rahmenlose Buttons mit Hover-Flaeche statt Hover-Unterstreichung
  // -- v. a. Schliessen-Icons in Dialogen/Overlays (haeufigstes Muster laut
  // Code-Survey, 10 Fundstellen, 9 davon bisher mit hartcodiertem
  // text-black/50 statt --c-text-muted).
  ghost: "text-text-muted hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-11 rounded-md px-4 py-2 text-sm",
  md: "min-h-12 rounded-md px-4 py-3",
  // "link": textbasierte Aktionen ohne Flaeche (Bearbeiten/Loeschen/Wieder
  // freigeben) -- negatives Aussenpolster (-mx-2) gleicht die Innenpolsterung
  // wieder aus, damit der Tap-Ziel-Bereich waechst, der Text aber optisch
  // buendig mit umgebendem Fliesstext bleibt. Immer mit variant="plain"
  // kombiniert (Textfarbe kommt von aussen).
  link: "flex min-h-11 items-center gap-1 px-2 -mx-2 text-sm",
};

// 44px Mindest-Tap-Ziel nach CLAUDE.md Prinzip 8, quadratisch/rund statt mit
// Textpolsterung -- fuer reine Icon-Buttons (Schliessen, Favorit, ...).
// "circle" bisher nur fuer freischwebende Bedienelemente ueber Karten/
// Bottom-Sheets (station-bottom-sheet.tsx) -- "square" (rounded-md) ist der
// Standardfall (Dialog-Kopfzeilen, s. Runde 6).
const ICON_ONLY_CLASSES = {
  square: "flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xl leading-none",
  circle: "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl leading-none",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Quadratischer Icon-Button (z. B. Schliessen "✕") statt Textpolsterung. */
  iconOnly?: boolean;
  /** Nur mit `iconOnly` relevant. @default "square" */
  iconShape?: "square" | "circle";
}

export function Button({
  variant = "primary",
  size = "sm",
  iconOnly = false,
  iconShape = "square",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const shapeClasses = iconOnly ? ICON_ONLY_CLASSES[iconShape] : SIZE_CLASSES[size];
  return (
    <button type={type} className={`${shapeClasses} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />
  );
}
