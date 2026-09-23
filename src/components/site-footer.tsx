import Link from "next/link";

export function SiteFooter() {
  // Auf Mobile-Breiten uebernimmt die permanente Bottom-Tab-Bar
  // (bottom-tab-bar.tsx) den unteren Bildschirmrand -- dieser Text-Footer
  // wuerde sonst teilweise dahinter verschwinden, da die Bar `fixed` ist.
  // Farbe: --c-base-deep, wie im Design-Paket (docs/design/website/index.html
  // .footer) -- dunkelster Ton der Marke, fuer den Seitenabschluss.
  // Impressum/Datenschutz muessen "staendig verfuegbar" sein (§5 DDG) --
  // auf Mobile uebernehmen stattdessen die Startseite und die
  // ProfileSidebar diese Verlinkung (siehe dort), da dieser Footer dort
  // gar nicht sichtbar ist.
  return (
    <footer className="mt-auto hidden bg-base-deep py-6 pb-[calc(1.5rem+var(--safe-bottom))] text-center text-xs text-text-inverse-muted md:block">
      <p>charge2camp &middot; MVP / Testversion &middot; Demo-Daten sind als [DEMO] gekennzeichnet</p>
      <p className="mt-2 flex justify-center gap-4">
        <Link href="/impressum" className="hover:underline">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:underline">
          Datenschutz
        </Link>
      </p>
    </footer>
  );
}
