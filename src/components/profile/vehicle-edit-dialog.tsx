"use client";

import { useState } from "react";
import type { Vehicle, VehicleModel } from "@/types/database";
import { deleteVehicle } from "@/app/profil/actions";
import { VehicleForm } from "./vehicle-form";

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
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">
            {vehicle.manufacturer} {vehicle.model} bearbeiten
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <VehicleForm models={models} vehicle={vehicle} onSaved={onClose} />

          <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-red-600">Elektroauto wirklich aus dem Profil löschen?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="min-h-11 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Ja, löschen
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-11 rounded-md px-4 py-2 text-sm font-medium text-black/60 hover:underline disabled:opacity-50 dark:text-white/60"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-11 text-sm font-medium text-red-600 hover:underline"
              >
                Elektroauto aus dem Profil löschen
              </button>
            )}
            {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
