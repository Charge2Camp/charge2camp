"use client";

import { useState } from "react";
import type { Vehicle, VehicleModel } from "@/types/database";
import { deleteVehicle } from "@/app/profil/actions";
import { VehicleForm } from "./vehicle-form";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
    <Modal open={open} onClose={onClose} title={`${vehicle.manufacturer} ${vehicle.model} bearbeiten`} size="lg">
      <VehicleForm models={models} vehicle={vehicle} onSaved={onClose} />

      <div className="mt-6 border-t border-line pt-4">
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
    </Modal>
  );
}
