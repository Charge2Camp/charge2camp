import type { MetadataRoute } from "next";

// Bislang gab es nur die (aelteren) Apple-spezifischen Meta-Tags fuer
// "Zum Home-Bildschirm" (siehe layout.tsx appleWebApp/other), aber KEIN
// Web-App-Manifest. Ab iOS 16.4 wertet Safari fuer zum Home-Bildschirm
// hinzugefuegte Seiten zusaetzlich den Standard-Manifest aus.
//
// display: "standalone" -- "fullscreen" wurde testweise ausprobiert
// (per Debug-Messung, safe-area-debug.tsx), um eine per Geraet gemessene
// 11px-Luecke zwischen window.innerHeight/visualViewport.height (841px)
// und screen.height (852px) zu schliessen (WebKit reserviert diesen Rest
// unterhalb des korrekt gemessenen env(safe-area-inset-bottom) nativ fuer
// "Add to Home Screen"-Web-Apps, ausserhalb jeder von der Seite aus
// erreichbaren Zeichenflaeche -- sichtbare Folge: cremefarbener/weisser
// Streifen unterhalb der Bottom-Tab-Bar). Ergebnis: iOS ignoriert
// display: "fullscreen" fuer Home-Screen-Web-Apps komplett (Statusleiste
// blieb sichtbar, exakt dieselben 841/852px wie zuvor) -- daher zurueck
// auf "standalone", das echte (und einzig von iOS unterstuetzte)
// Verhalten. Die Luecke ist eine harte WebKit-Plattformgrenze fuer
// Home-Screen-Web-Apps (nicht fuer echte native Apps) und bleibt bis zur
// spaeteren nativen App-Store-App bestehen.
// `background_color` entspricht der Flaechenfarbe der meisten Seiten
// (--c-surface), damit der kurze Splash-Screen beim Start nicht mit einem
// Farbsprung auffaellt.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "charge2camp – Camping mit Elektroauto",
    short_name: "charge2camp",
    description:
      "Finde Campingplätze und plane deine Route mit anhängertauglichen Ladestopps.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F0E8",
    theme_color: "#0F3B36",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
