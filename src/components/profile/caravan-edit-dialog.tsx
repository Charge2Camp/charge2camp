"use client";

import { useState } from "react";
import type { Caravan, CaravanModel } from "@/types/database";
import { deleteCaravan } from "@/app/profil/actions";
import { CaravanForm } from "./caravan-form";

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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">
            {caravan.manufacturer} {caravan.model} bearbeiten
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

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--safe-bottom))]">
          <CaravanForm models={models} caravan={caravan} onSaved={onClose} />

          <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-error">Wohnwagen wirklich aus dem Profil löschen?</span>
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
                  className="min-h-11 rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:underline disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-11 text-sm font-medium text-error hover:underline"
              >
                Wohnwagen aus dem Profil löschen
              </button>
            )}
            {deleteError && <p className="mt-2 text-sm text-error">{deleteError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
