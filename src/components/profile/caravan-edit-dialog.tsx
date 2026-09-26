"use client";

import { useState } from "react";
import type { Caravan, CaravanModel } from "@/types/database";
import { deleteCaravan } from "@/app/profil/actions";
import { CaravanForm } from "./caravan-form";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** Siehe VehicleEditDialog -- gleiches Prinzip fuer Wohnwagen. */
export function CaravanEditDialog({
  caravan,
  models,
  open,
  onClose,
  onDeleted,
}: {
  caravan: Caravan;
  models: CaravanModel[];
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
    const result = await deleteCaravan(caravan.id);
    if (result.ok) {
      onDeleted(caravan.id);
      onClose();
    } else {
      setDeleteError(result.error);
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${caravan.manufacturer} ${caravan.model} bearbeiten`} size="lg">
      <CaravanForm models={models} caravan={caravan} onSaved={onClose} />

      <div className="mt-6 border-t border-line pt-4">
        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-error">Wohnwagen wirklich aus dem Profil löschen?</span>
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
            Wohnwagen aus dem Profil löschen
          </Button>
        )}
        {deleteError && <FormError className="mt-2 text-sm">{deleteError}</FormError>}
      </div>
    </Modal>
  );
}
