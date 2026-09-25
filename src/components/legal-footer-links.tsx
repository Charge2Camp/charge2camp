import Link from "next/link";

/** Impressum/Datenschutz muessen "staendig verfuegbar" sein (§5 DDG). Auf
 * Mobile gibt es weder Header/Footer (site-footer.tsx bleibt dort
 * `hidden`) noch eine Bottom-Tab-Bar-Kachel dafuer -- betrifft alle oeffentlich
 * ohne Login erreichbaren Seiten (/, /login, /register, /passwort-vergessen,
 * /passwort-zuruecksetzen), nicht nur die Startseite (UX-05.6). Deshalb hier
 * direkt im Seiteninhalt jeder dieser Seiten eingebunden. */
export function LegalFooterLinks() {
  return (
    <p className="flex gap-4 text-xs text-black/40 dark:text-white/40">
      <Link href="/impressum" className="hover:underline">
        Impressum
      </Link>
      <Link href="/datenschutz" className="hover:underline">
        Datenschutz
      </Link>
    </p>
  );
}
