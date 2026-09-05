import type { ReactNode } from "react";
import { ProfileSubNav } from "@/components/profile/profile-sub-nav";

export default function ProfilLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <ProfileSubNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
