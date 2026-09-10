"use client";

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: "Angaben" },
  { step: 2, label: "Route" },
  { step: 3, label: "Fertig" },
];

/** Drei-Schritte-Fortschrittsanzeige fuer den Routenplaner-Assistenten
 * (Nutzerwunsch: uebersichtlicherer Ablauf auf dem Handy statt einer
 * langen, durchgescrollten Seite). Schritte 2/3 sind erst antippbar,
 * sobald eine Route berechnet wurde (`reachable`) -- vorher gibt es dort
 * schlicht nichts anzuzeigen. Reichweite geht NICHT verloren: alle Felder
 * bleiben im State der Elternkomponente, ein Tab-Wechsel ist nur ein
 * Render-Wechsel, kein Reset. */
export function RouteWizardTabs({
  activeStep,
  reachable,
  onSelectStep,
}: {
  activeStep: 1 | 2 | 3;
  /** Ab wann Schritt 2/3 erreichbar sind (sobald eine Route berechnet ist). */
  reachable: boolean;
  onSelectStep: (step: 1 | 2 | 3) => void;
}) {
  return (
    <ol className="flex items-center" aria-label="Fortschritt der Routenplanung">
      {STEPS.map(({ step, label }, i) => {
        const isActive = step === activeStep;
        const isDone = step < activeStep;
        const isReachable = step === 1 || reachable;

        return (
          <li key={step} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => onSelectStep(step)}
              aria-current={isActive ? "step" : undefined}
              className="flex min-h-11 items-center gap-2 rounded-md px-1 py-1 disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  isActive
                    ? "bg-route text-white"
                    : isDone
                      ? "border border-route text-route"
                      : isReachable
                        ? "border border-black/25 text-black/70 dark:border-white/25 dark:text-white/70"
                        : "border border-black/10 text-black/30 dark:border-white/10 dark:text-white/30"
                }`}
              >
                {isDone ? "✓" : step}
              </span>
              <span
                className={`text-sm font-medium ${
                  isActive
                    ? "text-route"
                    : isReachable
                      ? "text-black/70 dark:text-white/70"
                      : "text-black/30 dark:text-white/30"
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 h-px flex-1 ${isDone ? "bg-route" : "bg-black/10 dark:bg-white/10"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
