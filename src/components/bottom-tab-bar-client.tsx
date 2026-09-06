"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileSidebar } from "@/components/profile-sidebar";

const TABS = [
  { href: "/campingplaetze", label: "Camping", icon: "⛺" },
  { href: "/ladepunkte", label: "Laden", icon: "⚡" },
  { href: "/routenplaner", label: "Route", icon: "🧭" },
  { href: "/community", label: "Community", icon: "💬" },
] as const;

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] leading-tight ${
        active ? "text-emerald-600" : "text-black/60 dark:text-white/60"
      }`}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}

/** Permanent sichtbare Bottom-Tab-Bar fuer Touch-Bedienung (Apple-HIG-/
 * Android-Bottom-Navigation-Muster) -- ersetzt den bisherigen
 * Hamburger-Dropdown (mobile-nav.tsx) auf Mobile-Breiten. Die 5. Kachel
 * ("Profil") oeffnet keine Seite direkt, sondern die ProfileSidebar mit
 * allen Profil-Unterpunkten; ohne Anmeldung fuehrt sie stattdessen zu
 * /login. */
export function BottomTabBarClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileActive = pathname.startsWith("/profil");

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-background pb-[env(safe-area-inset-bottom)] md:hidden dark:border-white/10"
      >
        <ul className="flex">
          {TABS.map((tab) => (
            <li key={tab.href} className="flex flex-1">
              <TabLink {...tab} active={pathname.startsWith(tab.href)} />
            </li>
          ))}
          <li className="flex flex-1">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-haspopup="true"
                aria-expanded={sidebarOpen}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] leading-tight ${
                  profileActive ? "text-emerald-600" : "text-black/60 dark:text-white/60"
                }`}
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  👤
                </span>
                Profil
              </button>
            ) : (
              <TabLink href="/login" label="Anmelden" icon="👤" active={pathname === "/login"} />
            )}
          </li>
        </ul>
      </nav>

      {isLoggedIn && <ProfileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
    </>
  );
}
