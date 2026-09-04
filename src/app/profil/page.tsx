import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">{user.email}</p>

      <p className="mt-8 text-sm text-black/50 dark:text-white/50">
        Elektroauto- und Wohnwagendaten folgen in Phase 2 des MVP.
      </p>
    </div>
  );
}
