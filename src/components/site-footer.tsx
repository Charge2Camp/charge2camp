export function SiteFooter() {
  // Auf Mobile-Breiten uebernimmt die permanente Bottom-Tab-Bar
  // (bottom-tab-bar.tsx) den unteren Bildschirmrand -- dieser Text-Footer
  // wuerde sonst teilweise dahinter verschwinden, da die Bar `fixed` ist.
  return (
    <footer className="mt-auto hidden border-t border-black/10 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center text-xs text-black/50 md:block dark:border-white/10 dark:text-white/50">
      <p>Charge2Camp &middot; MVP / Testversion &middot; Demo-Daten sind als [DEMO] gekennzeichnet</p>
    </footer>
  );
}
