import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "charge2camp Admin",
  description: "Internes Verwaltungswerkzeug fuer charge2camp",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
