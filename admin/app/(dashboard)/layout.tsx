import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";

/** Gruppiert statt einer flachen Liste -- Nutzerwunsch: Dashboard/Nav
 * sollen "alle aktuellen Funktionen und Menüpunkte" sinnvoll abbilden.
 * Dubletten- und Recherche-Seiten waren bisher nur ueber Dashboard-Links
 * erreichbar, nicht ueber die Hauptnavigation. */
const NAV_GROUPS = [
  {
    label: "Ladestationen",
    items: [
      { href: "/ladestationen", label: "Übersicht" },
      { href: "/ladestationen/neu", label: "Anlegen" },
      { href: "/ladestationen/massenupload", label: "Massenupload" },
      { href: "/ladestationen/meldungen", label: "Meldungen" },
      { href: "/ladestationen/fehlende-saeulen", label: "Fehlende Säulen" },
      { href: "/ladestationen/dubletten", label: "Dubletten" },
    ],
  },
  {
    label: "Campingplätze",
    items: [
      { href: "/campingplaetze", label: "Übersicht" },
      { href: "/campingplaetze/recherche", label: "Recherche" },
      { href: "/campingplaetze/dubletten", label: "Dubletten" },
    ],
  },
  {
    label: "Referenzkataloge",
    items: [
      { href: "/fahrzeugmodelle", label: "Fahrzeugmodelle" },
      { href: "/wohnwagenmodelle", label: "Wohnwagenmodelle" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/nutzer", label: "Nutzer" },
      { href: "/datenqualitaet/woche", label: "Neu & geändert diese Woche" },
      { href: "/datenqualitaet/koordinaten", label: "Unplausible Koordinaten" },
    ],
  },
] as const;

const linkClass = "block min-h-11 rounded-md px-2 py-2 text-sm hover:bg-white/10";

function NavLinks() {
  return (
    <>
      <Link href="/" className={`${linkClass} font-medium`}>
        Dashboard
      </Link>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-2 flex flex-col gap-0.5">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-text-inverse/50">{group.label}</p>
          {group.items.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="shrink-0 border-b border-line bg-base text-text-inverse md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        {/* Mobil: Titel + zusammenklappbares Menü in einer Kopfzeile, damit
            Inhalt nicht erst nach einem Bildschirm voller Nav-Links beginnt
            (Nutzerfeedback: "gut auf dem Smartphone darstellen"). Rein
            HTML/CSS (details/summary), kein Client-JS noetig. Auf Desktop
            (md:) immer offene, klassische Sidebar. */}
        <details className="group p-4 md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold marker:content-none">
            charge2camp Admin
            <span className="text-xs font-normal text-text-inverse/60 group-open:hidden">Menü ▾</span>
            <span className="hidden text-xs font-normal text-text-inverse/60 group-open:inline">Schließen ▴</span>
          </summary>
          <nav className="mt-2 flex flex-col gap-0.5 pb-2">
            <NavLinks />
          </nav>
        </details>

        <div className="hidden p-4 md:flex md:min-h-screen md:flex-col">
          <p className="mb-3 px-2 font-semibold">charge2camp Admin</p>
          <nav className="flex flex-col gap-0.5">
            <NavLinks />
          </nav>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <p className="px-2 text-xs text-text-inverse/60">{admin.email}</p>
            <form action={signOut}>
              <button type="submit" className="min-h-11 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white/10">
                Abmelden
              </button>
            </form>
          </div>
        </div>

        {/* Abmelden bleibt auf Mobil unabhaengig vom Menue-Zustand erreichbar. */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 md:hidden">
          <p className="text-xs text-text-inverse/60">{admin.email}</p>
          <form action={signOut}>
            <button type="submit" className="min-h-11 rounded-md px-2 py-2 text-sm hover:bg-white/10">
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
