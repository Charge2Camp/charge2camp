"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profil", label: "Übersicht" },
  { href: "/community", label: "Community" },
  { href: "/profil/daten", label: "Meine Daten" },
  { href: "/profil/gespann", label: "Mein Gespann" },
  { href: "/profil/routen", label: "Meine Routen" },
  { href: "/profil/favoriten", label: "Favoriten" },
  { href: "/profil/bewertungen", label: "Bewertungen" },
  { href: "/profil/einstellungen", label: "Einstellungen" },
  { href: "/profil/legende", label: "Symbole & Begriffe" },
];

export function ProfileSubNav() {
  const pathname = usePathname();

  return (
    // Auf Mobile-Breiten uebernimmt die ProfileSidebar (ueber die
    // "Profil"-Kachel der Bottom-Tab-Bar) dieselbe Navigation -- diese Leiste
    // waere dort redundant, deshalb ab md: sichtbar.
    <nav className="mt-4 hidden flex-wrap gap-2 border-b border-black/10 pb-4 text-sm md:flex dark:border-white/10">
      {TABS.map((tab) => {
        const active = tab.href === "/profil" ? pathname === "/profil" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "flex min-h-11 items-center rounded-md bg-route px-3 text-white"
                : "flex min-h-11 items-center rounded-md px-3 hover:bg-black/5 dark:hover:bg-white/10"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
