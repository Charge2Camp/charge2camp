import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/ladestationen", label: "Ladestationen" },
  { href: "/ladestationen/meldungen", label: "Meldungen" },
  { href: "/campingplaetze", label: "Campingplätze" },
  { href: "/campingplaetze/recherche", label: "Recherche" },
  { href: "/nutzer", label: "Nutzer" },
] as const;

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
      <aside className="flex shrink-0 flex-col gap-1 border-b border-line bg-base p-4 text-text-inverse md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <p className="mb-3 px-2 font-semibold">charge2camp Admin</p>
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-h-11 rounded-md px-2 py-2 text-sm hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <p className="px-2 text-xs text-text-inverse/60">{admin.email}</p>
          <form action={signOut}>
            <button type="submit" className="min-h-11 w-full rounded-md px-2 py-2 text-left text-sm hover:bg-white/10">
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
