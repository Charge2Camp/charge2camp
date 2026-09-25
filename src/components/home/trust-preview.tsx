import { TRAILER_PIN_COLORS, TRAILER_PIN_LABELS, type TrailerPinState } from "@/lib/trailer-verdict";

const LEGEND_ORDER: TrailerPinState[] = [
  "drive_through",
  "ohne_abkoppeln",
  "bedingt_tauglich",
  "nicht_tauglich",
  "ungeprueft",
];

/** UX-05.3 (docs/design/ux-problems.md): Vor der Registrierung sieht ein
 * neuer Besucher aktuell keinerlei Beleg fuer den Produktnutzen -- jede
 * Aktion mit echten Daten fuehrt sofort zu /login. Diese Sektion bleibt
 * bewusst ohne Live-Datenzugriff (keine neue Ausnahme von require-user.ts,
 * das waere ein Sicherheits-Rollback, kein Design-Thema, s. dort) und zeigt
 * stattdessen die Anhaengertauglichkeits-Legende (brand-guide.md §7, real
 * und immer zutreffend, keine Scheindaten) plus GENAU EIN erfundenes
 * Beispiel, klar als "Beispiel" gekennzeichnet (CLAUDE.md Prinzip 2: keine
 * Scheindaten ohne eindeutige Kennzeichnung). */
export function TrustPreview() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-card border border-line bg-card p-5 text-left">
      <p className="text-sm font-medium text-text">So zeigt dir charge2camp, ob dein Gespann passt:</p>

      <ul className="flex flex-col gap-2">
        {LEGEND_ORDER.map((state) => (
          <li key={state} className="flex items-center gap-2 text-sm text-text-muted">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: TRAILER_PIN_COLORS[state] }}
            />
            {TRAILER_PIN_LABELS[state]}
          </li>
        ))}
      </ul>

      <div className="rounded-md border border-line bg-surface p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Beispiel, keine echten Daten</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-text">Autobahnraststätte (Beispiel)</p>
          {/* Lime traegt laut brand-guide.md §9 ausschliesslich dunklen Text,
              nie hellen (Kontrastregel) -- anders als bestehende Badges an
              anderer Stelle im Code (z. B. nearby-charging-modal.tsx), die
              das nicht befolgen; hier bewusst korrekt, ohne die anderen
              Stellen im Rahmen dieser Aenderung mitzuaendern. */}
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-xs text-text"
            style={{ backgroundColor: TRAILER_PIN_COLORS.drive_through }}
          >
            {TRAILER_PIN_LABELS.drive_through}
          </span>
        </div>
      </div>
    </div>
  );
}
