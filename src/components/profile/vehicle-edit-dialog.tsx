"use client";

import { useState } from "react";
import type { Vehicle, VehicleModel } from "@/types/database";
import { deleteVehicle } from "@/app/profil/actions";
import { VehicleForm } from "./vehicle-form";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

/** Pop-up zum Bearbeiten eines bereits gespeicherten Elektroautos
 * (Nutzerwunsch: statt "Löschen" auf der Liste gibt es jetzt "Bearbeiten",
 * ueber das alle Felder -- inkl. nachtraeglich die Ladeleistung -- geaendert
 * werden koennen; Loeschen ist von hier aus weiterhin moeglich, nur nicht
 * mehr die primaere Aktion auf der Liste selbst). Wiederverwendet
 * VehicleForm im Bearbeiten-Modus (siehe dort), damit die Hersteller/
 * Modell-Auswahl- und Feld-Logik nicht doppelt gepflegt werden muss. */
export function VehicleEditDialog({
  vehicle,
  models,
  open,
  onClose,
  onDeleted,
}: {
  vehicle: Vehicle;
  models: VehicleModel[];
  open: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!open) return null;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteVehicle(vehicle.id);
    if (result.ok) {
      onDeleted(vehicle.id);
      onClose();
    } else {
      setDeleteError(result.error);
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">
            {vehicle.manufacturer} {vehicle.model} bearbeiten
          </h2>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
          <VehicleForm models={models} vehicle={vehicle} onSaved={onClose} />

          <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-error">Elektroauto wirklich aus dem Profil löschen?</span>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  Ja, löschen
                </Button>
                <Button
                  variant="plain"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                  className="text-text-muted"
                >
                  Abbrechen
                </Button>
              </div>
            ) : (
              <Button variant="plain" size="link" onClick={() => setConfirmingDelete(true)} className="text-error">
                Elektroauto aus dem Profil löschen
              </Button>
            )}
            {deleteError && <FormError className="mt-2 text-sm">{deleteError}</FormError>}
          </div>
        </div>
      </div>
    </div>
  );
}
