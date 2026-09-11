"use client";

import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { AdminButton } from "@/components/admin-button";

/** "Mein Profil" + Abmelden (+ Admin, falls is_admin) -- nur auf der
 * Profil-Uebersicht selbst (Nutzerwunsch: auf allen /profil/*-Unterseiten
 * entfaellt dieser globale Kopfbereich, jede Unterseite zeigt stattdessen
 * ihre eigene, zum Menüeintrag passende Überschrift). */
export function ProfileHeader({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  if (pathname !== "/profil") return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <div className="flex items-center gap-2">
        {isAdmin && <AdminButton />}
        <LogoutButton />
      </div>
    </div>
  );
}
