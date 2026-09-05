"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex min-h-11 items-center rounded-md border border-black/10 px-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
    >
      Abmelden
    </button>
  );
}
