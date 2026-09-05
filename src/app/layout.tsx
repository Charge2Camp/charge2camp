import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "eCamper – Camping mit Elektroauto",
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
