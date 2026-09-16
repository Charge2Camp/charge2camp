import { ADMIN_LOGIN_URL } from "@/lib/admin-url";

/** Link zur eigenstaendigen Admin-Backend-App (Nutzerwunsch: nur fuer
 * Admins sichtbar, neben dem jeweiligen Abmelde-Button). Die Sichtbarkeit
 * hier ist nur UX -- der eigentliche Zugriffsschutz laeuft im Backend
 * selbst ueber requireAdmin()/profiles.is_admin (admin/lib/require-admin.ts),
 * ein Nicht-Admin landet dort auch bei direktem Aufruf auf "Kein Zugriff".
 *
 * Bewusst OHNE target="_blank": im mobilen "Zum Home-Bildschirm"-Standalone-
 * Modus (siehe layout.tsx appleWebApp) oeffnete ein neuer Tab einen
 * eingeschraenkten Browser-Kontext, in dem die Login-Seite zwar sichtbar war,
 * aber nicht hydrierte -- der Anmelden-Button reagierte dann auf keinen
 * Klick (Nutzerfeedback). Navigation im selben Tab/Fenster hat dieses
 * Problem nicht; ein separater Tab hat ausserdem in der spaeteren nativen
 * App ohnehin kein Aequivalent. */
export function AdminButton({ variant = "default" }: { variant?: "default" | "inverse" }) {
  return (
    <a
      href={ADMIN_LOGIN_URL}
      className={
        variant === "inverse"
          ? "flex min-h-11 items-center rounded-md border border-action px-3 text-action hover:bg-base-soft"
          : "flex min-h-11 items-center rounded-md border border-route px-3 text-route hover:bg-route/10"
      }
    >
      Admin
    </a>
  );
}
