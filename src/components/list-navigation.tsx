"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
 * Ladepunkt-/Campingplatz-Detailseite (Nutzerwunsch) -- nur sichtbar,
 * wenn die Seite tatsaechlich aus der zugehoerigen Listenuebersicht
 * erreicht wurde (per saveListNavigationContext) UND die aktuelle ID
 * Teil dieser Liste ist; sonst (Direktaufruf, externer Link, andere
 * Liste) bleibt der Block leer. */
export function ListNavigation({
  storageKey,
  detailPathPrefix,
  currentId,
}: {
  storageKey: string;
  /** z. B. "/ladepunkte/" -- Praefix fuer den Link zum naechsten Ergebnis. */
  detailPathPrefix: string;
  currentId: string;
}) {
  const [context, setContext] = useState<ListNavigationContext | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ListNavigationContext;
      void Promise.resolve().then(() => setContext(parsed));
    } catch {
      // Beschaedigter Eintrag -- einfach ignorieren, kein Fehler noetig.
    }
  }, [storageKey, currentId]);

  if (!context) return null;
  const index = context.ids.indexOf(currentId);
  if (index === -1) return null;
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
