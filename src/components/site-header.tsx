import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";

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
    // Das oberste Padding nutzt env(safe-area-inset-top) und respektiert so
    // die Notch/Dynamic Island, sobald die Seite randlos (viewport-fit=cover)
    // laeuft -- auf normalen Browsern ist der Wert 0 und aendert nichts.
    <header className="relative border-b border-black/10 pt-[env(safe-area-inset-top)] dark:border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2 py-2 font-semibold">
            <span className="text-emerald-600">e</span>Camper
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-emerald-600">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 text-sm sm:gap-2">
          {user ? (
            <>
              <Link
                href="/profil"
                className="flex min-h-11 items-center rounded-md px-2 hover:bg-black/5 hover:text-emerald-600 dark:hover:bg-white/10 sm:px-3"
              >
                Mein Profil
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex min-h-11 items-center rounded-md px-2 hover:bg-black/5 hover:text-emerald-600 dark:hover:bg-white/10 sm:px-3"
              >
                Anmelden
              </Link>
              <Link
                href="/register"
                className="flex min-h-11 items-center rounded-md bg-emerald-600 px-3 text-white hover:bg-emerald-700"
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
