import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Kein Zugriff</h1>
      <p className="text-sm text-text-muted">
        Dieses Konto ist angemeldet, hat aber keine Admin-Berechtigung fuer charge2camp.
      </p>
      <form action={signOut}>
        <button type="submit" className="min-h-11 rounded-md border border-line px-4 text-sm font-medium">
          Abmelden
        </button>
      </form>
    </div>
  );
}
