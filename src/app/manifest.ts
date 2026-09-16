import type { MetadataRoute } from "next";

// Bislang gab es nur die (aelteren) Apple-spezifischen Meta-Tags fuer
// "Zum Home-Bildschirm" (siehe layout.tsx appleWebApp/other), aber KEIN
// Web-App-Manifest. Ab iOS 16.4 wertet Safari fuer zum Home-Bildschirm
// hinzugefuegte Seiten zusaetzlich den Standard-Manifest aus.
//
// display: "fullscreen" statt "standalone" -- per Debug-Messung
// (safe-area-debug.tsx) bestaetigt: im "standalone"-Modus war
// window.innerHeight/visualViewport.height (841px) auf einem iPhone 14
// Pro durchgehend 11px KLEINER als screen.height (852px), obwohl
// env(safe-area-inset-bottom) korrekt gemessen und angewendet wurde
// (siehe safe-area-sync.tsx) -- dieser Rest-Bereich liegt ausserhalb der
// WKWebView-Zeichenflaeche und ist damit fuer KEIN CSS/JS auf der Seite
// erreichbar (WebKit reserviert ihn nativ, nur echte Apps koennen dort
// zeichnen). Sichtbare Folge: cremefarbener/weisser Streifen unterhalb
// der Bottom-Tab-Bar, unabhaengig von allen Safe-Area-Fixes.
// "fullscreen" blendet zusaetzlich die Statusleiste (Uhrzeit/Akku/Empfang)
// komplett aus, in der Hoffnung, dass WebKit die WKWebView dafuer auf die
// tatsaechliche volle Bildschirmhoehe vergroessert -- muss auf dem
// betroffenen Geraet erneut per Debug-Overlay verifiziert werden.
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
    display: "fullscreen",
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
