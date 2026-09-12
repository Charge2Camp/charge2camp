"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Zwischengespeicherter Kontext einer Listenuebersicht (Ladepunkte/
 * Campingplaetze), gesetzt beim Antippen eines Listeneintrags -- siehe
 * saveListNavigationContext. `ids` in genau der Reihenfolge, in der sie in
 * der Liste standen (aktuelle Sortierung/Filter), damit "Naechstes
 * Ergebnis" der tatsaechlichen Browsing-Reihenfolge folgt. */
interface ListNavigationContext {
  returnUrl: string;
  ids: string[];
}

/** Speichert vor dem Wechsel von der Listenuebersicht auf eine
 * Detailseite, WELCHE Liste (Reihenfolge + URL inkl. aktiver Filter) man
 * gerade durchsucht hat (Nutzerwunsch: von der Detailseite direkt zum
 * naechsten Ergebnis springen oder zur Liste zurueck koennen). Wird NICHT
 * nach Gebrauch geloescht -- bleibt fuer wiederholtes "Naechstes
 * Ergebnis" bestehen, bis der Nutzer eine neue Liste durchsucht (dann
 * ueberschrieben) oder der Tab schliesst (sessionStorage). */
export function saveListNavigationContext(storageKey: string, ids: string[]) {
  try {
    const context: ListNavigationContext = {
      returnUrl: window.location.pathname + window.location.search,
      ids,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(context));
  } catch {
    // sessionStorage nicht verfuegbar (z. B. privater Modus) -- die
    // Detailseite zeigt dann einfach keine Listen-Navigation an.
  }
}

/** "Zurück zur Übersicht" / "Nächstes Ergebnis" ganz oben auf einer
 * Ladepunkt-/Campingplatz-Detailseite (Nutzerwunsch) -- wenn die Seite aus
 * der zugehoerigen Listenuebersicht erreicht wurde (per
 * saveListNavigationContext) UND die aktuelle ID Teil dieser Liste ist,
 * erscheint der volle Uebersicht+Naechstes-Block. In JEDEM anderen Fall
 * (Kartenpin-Popup, Startseiten-Modal, Direktlink, ...) gibt es trotzdem
 * IMMER einen expliziten Zurueck-Button -- Nutzerwunsch: von einer
 * Detailseite muss man sich unabhaengig vom Einstiegspunkt immer zum
 * vorherigen Screen zurueckbewegen koennen, nicht nur ueber die
 * (auf mobil/als spaetere native App oft nicht sichtbare) Browser-
 * Zurueck-Funktion. */
export function ListNavigation({
  storageKey,
  detailPathPrefix,
  currentId,
}: {
  storageKey: string;
  /** z. B. "/ladepunkte/" -- Praefix fuer den Link zum naechsten Ergebnis
   * bzw. (ohne Listen-Kontext) fuer den Fallback-Link zur Uebersicht. */
  detailPathPrefix: string;
  currentId: string;
}) {
  const router = useRouter();
  const [context, setContext] = useState<ListNavigationContext | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ListNavigationContext;
        void Promise.resolve().then(() => setContext(parsed));
      }
    } catch {
      // Beschaedigter Eintrag -- einfach ignorieren, kein Fehler noetig.
    }
    // Mehr als ein Eintrag in der History dieses Tabs heisst: es gibt
    // tatsaechlich eine vorherige Seite, zu der der Browser zurueck kann
    // (z. B. Kartenpin-Popup oder Startseiten-Modal) -- sonst (Detailseite
    // direkt per URL/Lesezeichen geoeffnet) faellt der Button stattdessen
    // auf einen Link zur allgemeinen Uebersicht zurueck.
    void Promise.resolve().then(() => setCanGoBack(window.history.length > 1));
  }, [storageKey, currentId]);

  const index = context?.ids.indexOf(currentId) ?? -1;
  if (context && index !== -1) {
    const nextId = index < context.ids.length - 1 ? context.ids[index + 1] : null;
    return (
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <Link href={context.returnUrl} className="inline-flex min-h-11 items-center font-medium text-route hover:underline">
          ← Zurück zur Übersicht
        </Link>
        {nextId && (
          <Link
            href={`${detailPathPrefix}${nextId}`}
            className="inline-flex min-h-11 items-center font-medium text-route hover:underline"
          >
            Nächstes Ergebnis →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 text-sm">
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex min-h-11 items-center font-medium text-route hover:underline"
        >
          ← Zurück
        </button>
      ) : (
        <Link
          href={detailPathPrefix.replace(/\/$/, "")}
          className="inline-flex min-h-11 items-center font-medium text-route hover:underline"
        >
          ← Zur Übersicht
        </Link>
      )}
    </div>
  );
}
