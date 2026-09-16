"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { AdminButton } from "@/components/admin-button";

const TABS = [
  { href: "/profil", label: "Übersicht" },
  { href: "/community", label: "Community" },
  { href: "/profil/daten", label: "Meine Daten" },
  { href: "/profil/gespann", label: "Mein Gespann" },
  { href: "/profil/routen", label: "Meine Routen" },
  { href: "/profil/favoriten", label: "Favoriten" },
  { href: "/profil/fehlende-saeule", label: "Säule melden" },
  { href: "/profil/bewertungen", label: "Bewertungen" },
  { href: "/profil/einstellungen", label: "Einstellungen" },
  { href: "/profil/legende", label: "Symbole & Begriffe" },
];

/** Sidebar mit allen Profil-Unterpunkten -- oeffnet sich vom rechten
 * Bildschirmrand, ausgeloest ueber die "Profil"-Kachel in der
 * Bottom-Tab-Bar (siehe bottom-tab-bar-client.tsx). Nur auf Mobile/Touch
 * relevant (md:hidden) -- am Desktop uebernimmt weiterhin die
 * ProfileSubNav-Leiste innerhalb der Profilseite dieselbe Navigation.
 * Enthaelt bewusst auch "Community" (docs/design/brand-guide.md Abschnitt
 * 6: auf schmalen Geraeten liegt Community im Profil statt in der
 * Bottom-Tab-Bar). */
export function ProfileSidebar({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-y-0 right-0 flex w-72 max-w-[80vw] flex-col bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-display text-lg font-bold">Mein Profil</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-text-muted hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {TABS.map((tab) => {
            const active = tab.href === "/profil" ? pathname === "/profil" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={onClose}
                className={
                  active
                    ? "flex min-h-12 items-center rounded-md bg-route px-3 text-white"
                    : "flex min-h-12 items-center rounded-md px-3 hover:bg-black/5"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-line p-2">
          {isAdmin && <AdminButton />}
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
