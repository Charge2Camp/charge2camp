import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export default async function MeineDatenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <section>
      <h2 className="text-lg font-semibold">Meine Daten</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-black/50 dark:text-white/50">E-Mail-Adresse</dt>
          <dd className="mt-0.5">{user.email}</dd>
        </div>
        {user.created_at && (
          <div>
            <dt className="text-black/50 dark:text-white/50">Konto erstellt am</dt>
            <dd className="mt-0.5">{formatDate(user.created_at)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-6 text-sm text-black/50 dark:text-white/50">
        Ändern von E-Mail-Adresse oder Passwort ist hier noch nicht möglich und folgt in einer
        späteren Phase.
      </p>
    </section>
  );
}
