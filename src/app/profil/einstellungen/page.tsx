import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <section>
      <h2 className="text-lg font-semibold">Einstellungen</h2>
      <p className="mt-4 text-sm text-black/60 dark:text-white/60">
        Es gibt aktuell noch keine App-Einstellungen (z. B. Sprache, Benachrichtigungen). Diese
        Seite folgt in einer späteren Phase.
      </p>
    </section>
  );
}
