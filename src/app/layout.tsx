import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomTabBar } from "@/components/bottom-tab-bar";

// charge2camp-Markentypografie (docs/design/brand-guide.md Abschnitt 4):
// Manrope 700 fuer Ueberschriften, Inter 400/500 fuer Fliesstext/UI.
const manrope = Manrope({
  variable: "--font-display",
  weight: ["700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-ui",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "charge2camp – Camping mit Elektroauto",
  description:
    "Finde Campingplätze und plane deine Route mit anhängertauglichen Ladestopps.",
  // Ohne diese beiden Angaben oeffnet iOS ein "Zum Home-Bildschirm"-Icon nur
  // in einer abgespeckten Safari-Ansicht (eigene, nicht transparente
  // Statusleisten-Behandlung) statt echtem Vollbild-Standalone-Modus --
  // sichtbare Folge war ein cremefarbener Streifen zwischen Statusleiste
  // und der (eigentlich randlosen) Ladepunkte-Karte auf dem iPhone
  // (Nutzerfeedback). "black-translucent" macht die Statusleiste
  // durchsichtig, Inhalte duerfen dann unter ihr zeichnen -- genau das
  // Verhalten, fuer das env(safe-area-inset-*)/viewport-fit=cover unten
  // schon vorbereitet waren.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "charge2camp",
  },
  // Diese Next.js-Version generiert aus appleWebApp.capable nur noch das
  // standardisierte <meta name="mobile-web-app-capable">, nicht mehr das
  // veraltete <meta name="apple-mobile-web-app-capable"> (siehe
  // node_modules/next/dist/docs/.../generate-metadata.md, Abschnitt
  // appleWebApp -- AGENTS.md warnt genau vor solchen Breaking Changes).
  // Auf iOS-Versionen, die den Standard-Tag noch nicht respektieren (oder
  // ihn nur fuers Verstecken der Safari-Leiste, nicht aber fuer randloses
  // Zeichnen unter dem Home-Indicator auswerten), fehlte dadurch der echte
  // Vollbild-/Safe-Area-Modus -- sichtbare Folge war ein cremefarbener
  // Streifen unterhalb der Bottom-Tab-Bar, obwohl deren eigenes
  // env(safe-area-inset-bottom)-Padding korrekt gesetzt ist (Nutzerfeedback,
  // per Screenshot bestaetigt). Der veraltete Tag manuell ergaenzt, fuer
  // maximale Kompatibilitaet ueber alle iOS-Versionen hinweg.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Ohne dieses Viewport-Meta faellt iOS Safari auf eine Desktop-Layout-
// Breite von ca. 980px zurueck -- alle Tailwind-Breakpoints (sm:, md:, ...)
// wuerden dann auf echten Handys falsch auswerten (die Seite "denkt", sie
// sei auf einem breiten Bildschirm). Nutzer-Zoom bleibt bewusst erlaubt
// (kein maximumScale/userScalable:false -- das waere ein
// Barrierefreiheits-Problem, WCAG 1.4.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // "cover" macht die env(safe-area-inset-*) CSS-Variablen nutzbar (Notch/
  // Dynamic Island/Home-Indicator) -- wichtig, sobald die Seite spaeter als
  // native iOS-App (randlos, ohne Browser-Chrome) verpackt wird. Ohne
  // "cover" bleiben diese Variablen 0 und Inhalte koennten unter der Notch
  // oder Home-Indicator-Leiste liegen.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${manrope.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-text">
        <SiteHeader />
        {/* Mobil (< md) hat KEINEN Header (siehe site-header.tsx, komplett
            ausgeblendet) -- ohne eigenes Top-Padding hier wuerde der
            Seiteninhalt in der als Home-Screen-App gestarteten Standalone-
            Ansicht (statusBarStyle "black-translucent", randlos) direkt
            unter der Statusleiste/Notch beginnen und dort teils verdeckt
            wirken ("zu weit oben"). In der normalen Mobile-Browser-Ansicht
            ist env(safe-area-inset-top) dagegen 0 (Safaris eigene Leiste
            belegt den Bereich bereits) -- daher bewusst NICHT als fixer
            Wert, sondern ueber env(), damit sich das Padding automatisch an
            Browser- vs. Home-App-Kontext anpasst (Nutzerfeedback: "Screen
            manchmal zu weit oben/falsch platziert, je nachdem ob Browser
            oder Home-App"). Ab md: durch den eigenen Header ueberfluessig,
            deshalb dort zurueckgesetzt.
            Bottom-Tab-Bar (mobile) ist fixed -- Bodenabstand verhindert,
            dass sie den unteren Seiteninhalt ueberdeckt, ebenfalls inkl.
            env(safe-area-inset-bottom) aus demselben Grund (ohne den
            Zusatz passt der Abstand nur in der normalen Mobile-Browser-
            Ansicht, nicht in der um den Home-Indicator-Bereich gewachsenen
            Standalone-Tab-Bar, siehe bottom-tab-bar-client.tsx
            pb-[env(...)]). */}
        <main className="flex-1 pt-[env(safe-area-inset-top)] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          {children}
        </main>
        <SiteFooter />
        <BottomTabBar />
      </body>
    </html>
  );
}
