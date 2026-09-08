"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({ variant = "default" }: { variant?: "default" | "inverse" }) {
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
      className={
        variant === "inverse"
          ? "flex min-h-11 items-center rounded-md border border-base-soft px-3 text-text-inverse-muted hover:bg-base-soft hover:text-text-inverse"
          : "flex min-h-11 items-center rounded-md border border-line px-3 hover:bg-black/5"
      }
    >
      Abmelden
    </button>
  );
}
