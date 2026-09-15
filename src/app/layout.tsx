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
        {/* Bottom-Tab-Bar (mobile) ist fixed -- Bodenabstand verhindert, dass
            sie den unteren Seiteninhalt ueberdeckt. Nur auf Mobile-Breiten
            noetig, da die Bar selbst md:hidden ist. */}
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <SiteFooter />
        <BottomTabBar />
      </body>
    </html>
  );
}
