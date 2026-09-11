import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ProfileSubNav } from "@/components/profile/profile-sub-nav";
import { ProfileHeader } from "@/components/profile/profile-header";

export default async function ProfilLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ProfileHeader isAdmin={isAdmin} />
      <ProfileSubNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
