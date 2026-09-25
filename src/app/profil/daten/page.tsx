import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeAddressForm } from "@/components/profile/home-address-form";
import { DeleteAccountForm } from "@/components/profile/delete-account-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ChangeEmailForm } from "@/components/profile/change-email-form";

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
          <dt className="text-text-muted">E-Mail-Adresse</dt>
          <dd className="mt-0.5">{user.email}</dd>
        </div>
        {user.created_at && (
          <div>
            <dt className="text-text-muted">Konto erstellt am</dt>
            <dd className="mt-0.5">{formatDate(user.created_at)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6">
        <h3 className="font-medium">Zuhause-Adresse</h3>
        <p className="mt-1 text-xs text-text-muted">
          Ermöglicht im Routenplaner den Button &bdquo;Zuhause verwenden&ldquo; für Start oder
          Ziel. Leer lassen und speichern, um die Adresse wieder zu entfernen.
        </p>
        <HomeAddressForm initialAddress={profile?.home_address ?? ""} />
      </div>

      <div className="mt-6">
        <h3 className="font-medium">E-Mail-Adresse ändern</h3>
        <p className="mt-1 text-xs text-text-muted">
          Je nach Einstellung muss der Wechsel per Bestätigungslink (an die neue, ggf. auch die
          alte Adresse) bestätigt werden, bevor er wirksam wird.
        </p>
        <ChangeEmailForm />
      </div>

      <div className="mt-8">
        <h3 className="font-medium">Passwort ändern</h3>
        <p className="mt-1 text-xs text-text-muted">
          Zur Sicherheit wird das aktuelle Passwort erneut abgefragt.
        </p>
        <ChangePasswordForm />
      </div>

      <div className="mt-8">
        <h3 className="font-medium">Meine Daten herunterladen</h3>
        <p className="mt-1 text-xs text-text-muted">
          Lädt alle bei uns über dich gespeicherten Daten (Profil, Fahrzeuge/Wohnwagen,
          Favoriten, Bewertungen, gespeicherte Routen) als JSON-Datei herunter.
        </p>
        <a
          href="/api/account/export"
          className="mt-2 inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
        >
          Daten herunterladen
        </a>
      </div>

      <div className="mt-8 rounded-md border border-red-600/30 p-4">
        <h3 className="font-medium text-error">Konto löschen</h3>
        <p className="mt-1 text-xs text-text-muted">
          Löscht dein Konto und alle zugehörigen Daten (Fahrzeuge, Wohnwagen, Favoriten,
          Bewertungen, gespeicherte Routen) unwiderruflich.
        </p>
        <DeleteAccountForm email={user.email ?? ""} />
      </div>
    </section>
  );
}
