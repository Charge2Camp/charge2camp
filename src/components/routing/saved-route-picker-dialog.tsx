"use client";

import { Modal } from "@/components/ui/modal";

export interface SavedRouteOption {
  id: string;
  name: string;
  startDisplayName: string;
  endDisplayName: string;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

/** Alternative zum Neuanlegen einer Route (Nutzerwunsch): bevor eine Route
 * berechnet wurde, kann hier stattdessen eine bereits unter "Meine Routen"
 * (Profil) gespeicherte Route direkt im Routenplaner geoeffnet werden --
 * bisher war das nur ueber den Link "Im Routenplaner öffnen" auf der
 * Profilseite selbst moeglich (?savedRouteId=..., siehe route-planner-
 * form.tsx loadAndApplySavedRoute). */
export function SavedRoutePickerDialog({
  open,
  savedRoutes,
  busy,
  onClose,
  onPick,
}: {
  open: boolean;
  savedRoutes: SavedRouteOption[];
  /** true, waehrend eine gewaehlte Route geladen/neu geplant wird. */
  busy: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Gespeicherte Route öffnen">
      {savedRoutes.length === 0 ? (
        <p className="text-sm text-text-muted">
          Noch keine Route gespeichert -- berechne unten eine Route und speichere sie in Tab 3
          &quot;Fertig&quot;.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {savedRoutes.map((route) => (
            <li key={route.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(route.id)}
                className="flex w-full flex-col gap-0.5 rounded-md border border-line px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              >
                <span className="font-medium">{route.name}</span>
                <span className="text-xs text-text-muted">
                  {route.startDisplayName} → {route.endDisplayName}
                </span>
                <span className="text-xs text-text-muted">Gespeichert am {formatDate(route.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
