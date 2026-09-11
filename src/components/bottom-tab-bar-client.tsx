"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileSidebar } from "@/components/profile-sidebar";
import { IconCamping, IconLaden, IconProfil, IconRoute } from "@/components/icons/brand-icons";

const TABS = [
  { href: "/campingplaetze", label: "Camping", Icon: IconCamping },
  { href: "/ladepunkte", label: "Laden", Icon: IconLaden },
  { href: "/routenplaner", label: "Route", Icon: IconRoute },
] as const;

function TabLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] leading-tight ${
        active ? "text-route" : "text-text-inverse-muted"
      }`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Permanent sichtbare Bottom-Tab-Bar fuer Touch-Bedienung (Apple-HIG-/
 * Android-Bottom-Navigation-Muster). Bewusst nur 4 Kacheln
 * (docs/design/brand-guide.md Abschnitt 6: "Menueleiste: Laden, Route,
 * Camping, Profil. Community liegt im Profil -- fuenf Tabs sind auf
 * schmalen Geraeten zu viel.") -- Community ist stattdessen ein Eintrag
 * in der ProfileSidebar (siehe dort). Die 4. Kachel ("Profil") oeffnet
 * keine Seite direkt, sondern die ProfileSidebar mit allen
 * Profil-Unterpunkten; ohne Anmeldung fuehrt sie stattdessen zu /login. */
export function BottomTabBarClient({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const profileActive = pathname.startsWith("/profil") || pathname.startsWith("/community");

  return (
    <>
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 bg-base pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  profileActive ? "text-route" : "text-text-inverse-muted"
                }`}
              >
                <IconProfil className="h-6 w-6" aria-hidden="true" />
                Profil
              </button>
            ) : (
              <TabLink href="/login" label="Anmelden" Icon={IconProfil} active={pathname === "/login"} />
            )}
          </li>
        </ul>
      </nav>

      {isLoggedIn && <ProfileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} />}
    </>
  );
}
