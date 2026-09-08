import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

const NAV_LINKS = [
  { href: "/campingplaetze", label: "Campingplätze" },
  { href: "/ladepunkte", label: "Ladepunkte" },
  { href: "/routenplaner", label: "Route planen" },
  { href: "/community", label: "Community" },
];

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    // Kopfbereich in --c-base (dunkelgruen), siehe docs/design/brand-guide.md
    // Abschnitt 3 ("Kopfbereiche, Text, dunkle Flaechen") -- Referenz-
    // umsetzung in docs/design (website/index.html, .top). Das oberste
    // Padding nutzt env(safe-area-inset-top) und respektiert so die
    // Notch/Dynamic Island, sobald die Seite randlos (viewport-fit=cover)
    // laeuft -- auf normalen Browsern ist der Wert 0 und aendert nichts.
    <header className="relative bg-base pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 py-2">
            <Image src="/logo/icon-dark.svg" alt="" width={36} height={36} className="rounded-[9px]" />
            <span className="font-display text-lg font-bold text-text-inverse">
              charge<span className="text-action">2</span>camp
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-text-inverse-muted md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-text-inverse">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auf Mobile-Breiten uebernimmt die Bottom-Tab-Bar (bottom-tab-bar.tsx)
            sowohl den Profil-Zugriff als auch den Anmelden-Link -- hier
            deshalb ab md: sichtbar, um doppelte Navigation zu vermeiden. */}
        <div className="hidden items-center gap-1 text-sm sm:gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/profil"
                className="flex min-h-11 items-center rounded-md px-2 text-text-inverse-muted hover:bg-base-soft hover:text-text-inverse sm:px-3"
              >
                Mein Profil
              </Link>
              <LogoutButton variant="inverse" />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex min-h-11 items-center rounded-md px-2 text-text-inverse-muted hover:bg-base-soft hover:text-text-inverse sm:px-3"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="flex min-h-11 items-center rounded-md bg-action px-3 font-medium text-base hover:bg-action-hover"
              >
                Registrieren
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
