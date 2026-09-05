import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeAddressForm } from "@/components/profile/home-address-form";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export default async function MeineDatenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("home_address")
    .eq("id", user.id)
    .maybeSingle();

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

      <div className="mt-6">
        <h3 className="font-medium">Zuhause-Adresse</h3>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          Ermöglicht im Routenplaner den Button &bdquo;Zuhause verwenden&ldquo; für Start oder
          Ziel. Leer lassen und speichern, um die Adresse wieder zu entfernen.
        </p>
        <HomeAddressForm initialAddress={profile?.home_address ?? ""} />
      </div>

      <p className="mt-6 text-sm text-black/50 dark:text-white/50">
        Ändern von E-Mail-Adresse oder Passwort ist hier noch nicht möglich und folgt in einer
        späteren Phase.
      </p>
    </section>
  );
}
