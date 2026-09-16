import type { MetadataRoute } from "next";

// Bislang gab es nur die (aelteren) Apple-spezifischen Meta-Tags fuer
// "Zum Home-Bildschirm" (siehe layout.tsx appleWebApp/other), aber KEIN
// Web-App-Manifest. Ab iOS 16.4 wertet Safari fuer zum Home-Bildschirm
// hinzugefuegte Seiten zusaetzlich den Standard-Manifest aus (display:
// "standalone" u. a.) -- ohne ihn verlaesst sich das Standalone-Rendering
// ausschliesslich auf die Meta-Tags, was bei manchen iOS-Versionen zu
// inkonsistentem Verhalten am unteren Bildschirmrand (Home-Indicator-
// Bereich) fuehren kann (Nutzerfeedback: cremefarbener/weisser Streifen
// unterhalb der Bottom-Tab-Bar, reproduzierbar auf mehreren frisch
// installierten iPhones). `background_color` entspricht der Flaechenfarbe
// der meisten Seiten (--c-surface), damit der kurze Splash-Screen beim
// Start nicht mit einem Farbsprung auffaellt.
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
