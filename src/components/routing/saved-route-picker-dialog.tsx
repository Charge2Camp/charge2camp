"use client";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+env(safe-area-inset-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">Gespeicherte Route öffnen</h2>
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
          {savedRoutes.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
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
                    className="flex w-full flex-col gap-0.5 rounded-md border border-black/10 px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <span className="font-medium">{route.name}</span>
                    <span className="text-xs text-black/50 dark:text-white/50">
                      {route.startDisplayName} → {route.endDisplayName}
                    </span>
                    <span className="text-xs text-black/40 dark:text-white/40">
                      Gespeichert am {formatDate(route.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
