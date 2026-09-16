export function SiteFooter() {
  // Auf Mobile-Breiten uebernimmt die permanente Bottom-Tab-Bar
  // (bottom-tab-bar.tsx) den unteren Bildschirmrand -- dieser Text-Footer
  // wuerde sonst teilweise dahinter verschwinden, da die Bar `fixed` ist.
  // Farbe: --c-base-deep, wie im Design-Paket (docs/design/website/index.html
  // .footer) -- dunkelster Ton der Marke, fuer den Seitenabschluss.
  return (
    <footer className="mt-auto hidden bg-base-deep py-6 pb-[calc(1.5rem+var(--safe-bottom))] text-center text-xs text-text-inverse-muted md:block">
      <p>charge2camp &middot; MVP / Testversion &middot; Demo-Daten sind als [DEMO] gekennzeichnet</p>
    </footer>
  );
}
