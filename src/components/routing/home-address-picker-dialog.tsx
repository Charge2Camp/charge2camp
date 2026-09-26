"use client";

import { Button } from "@/components/ui/button";

/** Fragt (ohne Zwischenschritt, da nur ein Ort) direkt "Als Start oder Ziel
 * verwenden?" fuer die im Profil hinterlegte Zuhause-Adresse -- analog zum
 * zweiten Schritt von favorites-picker-dialog.tsx. */
export function HomeAddressPickerDialog({
  open,
  homeAddress,
  onClose,
  onPick,
}: {
  open: boolean;
  homeAddress: { name: string; latitude: number; longitude: number } | null;
  onClose: () => void;
  onPick: (target: "start" | "end") => void;
}) {
  if (!open || !homeAddress) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">Als Start oder Ziel verwenden?</h2>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                Zuhause
              </span>
              {homeAddress.name}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onPick("start")}
                className="min-h-12 flex-1 rounded-md border border-route px-4 py-3 text-sm font-medium text-route hover:bg-route/10 "
              >
                Als Start verwenden
              </button>
              <button
                type="button"
                onClick={() => onPick("end")}
                className="min-h-12 flex-1 rounded-md bg-action px-4 py-3 text-sm font-medium text-base hover:bg-action-hover"
              >
                Als Ziel verwenden
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
