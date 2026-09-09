"use client";

/** Submit-Button fuer destruktive Server Actions (Konto loeschen o. ae.) --
 * fragt per window.confirm() nach, bevor das umschliessende <form>
 * abgeschickt wird. */
export function ConfirmSubmitButton({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
