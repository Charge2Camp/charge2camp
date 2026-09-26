"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
  if (!homeAddress) return null;

  return (
    <Modal open={open} onClose={onClose} title="Als Start oder Ziel verwenden?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          <span className="mr-2 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">Zuhause</span>
          {homeAddress.name}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onPick("start")}
            className="min-h-12 flex-1 rounded-md border border-route px-4 py-3 text-sm font-medium text-route hover:bg-route/10"
          >
            Als Start verwenden
          </button>
          <Button size="md" onClick={() => onPick("end")} className="flex-1">
            Als Ziel verwenden
          </Button>
        </div>
      </div>
    </Modal>
  );
}
