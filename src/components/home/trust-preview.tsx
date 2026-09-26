import { TRAILER_PIN_COLORS, TRAILER_PIN_LABELS, TRAILER_PIN_TEXT_CLASS, type TrailerPinState } from "@/lib/trailer-verdict";
import { Card } from "@/components/ui/card";

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
    <Card variant="emphasis" className="flex w-full flex-col gap-4 bg-card text-left">
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

      <Card className="bg-surface">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-muted">Beispiel, keine echten Daten</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-text">Autobahnraststätte (Beispiel)</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${TRAILER_PIN_TEXT_CLASS.drive_through}`}
            style={{ backgroundColor: TRAILER_PIN_COLORS.drive_through }}
          >
            {TRAILER_PIN_LABELS.drive_through}
          </span>
        </div>
      </Card>
    </Card>
  );
}
