import { forwardRef } from "react";
import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** §14 des Design-Briefs -- s. button.tsx fuer den Kontext. Das mit
 * Abstand konsistenteste Muster im gesamten Code (ein einziges
 * dominantes Klassenmuster an ~50 Fundstellen, per Survey bestaetigt) --
 * hier erstmals als echte Komponente statt an jeder Stelle erneut
 * abgeschrieben. `text-base` ist Pflicht (verhindert iOS-Auto-Zoom,
 * CLAUDE.md Prinzip 8), nicht weglassbar. */
const FIELD_CLASSES = "w-full rounded-md border border-line-strong px-3 py-2 text-base disabled:opacity-50 dark:bg-transparent";

// forwardRef statt einer einfachen Funktionskomponente: route-planner-form.tsx
// braucht einen echten DOM-Ref fuer einen nicht-passiven wheel-Listener
// (useNumberFieldWheel), ein normales Funktions-Prop kann das nicht abbilden.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...props },
  ref
) {
  return <input ref={ref} className={`${FIELD_CLASSES} ${className}`} {...props} />;
});

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASSES} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} ${className}`} {...props} />;
}

/** Label-Wrapper-Muster (49 Fundstellen laut Survey, identisch bis auf
 * den Inhalt): Label-Text, darunter das Feld. `gap-1` zwischen Label und
 * Feld, `text-sm` fuer den Label-Text selbst (das Feld traegt sein
 * eigenes `text-base`). */
export function Field({
  label,
  children,
  className = "",
  ...props
}: { label: ReactNode; children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`} {...props}>
      {label}
      {children}
    </label>
  );
}
