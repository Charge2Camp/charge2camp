import type { ReactNode } from "react";
import { ProfileSubNav } from "@/components/profile/profile-sub-nav";
import { LogoutButton } from "@/components/logout-button";

export default function ProfilLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Mein Profil</h1>
        {/* Bislang nur ueber die Sidebar (Profil-Kachel der Bottom-Tab-Bar)
            erreichbar -- auf dieser Seite selbst gab es keinen Ausweg zum
            Abmelden, wenn man z. B. direkt ueber einen Link hierher kam
            (siehe Design-Review). Jetzt auf jeder /profil/*-Unterseite
            direkt sichtbar, redundant zur Sidebar, aber nie fehlend. */}
        <LogoutButton />
      </div>
      <ProfileSubNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
