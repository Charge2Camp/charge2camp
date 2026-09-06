import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Charge2Camp – Camping mit Elektroauto",
  description:
    "Finde Campingplätze und plane deine Route mit anhängertauglichen Ladestopps.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
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
