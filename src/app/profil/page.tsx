import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function countFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [vehicleCount, caravanCount, savedRouteCount, favoriteCount, campsiteReviewCount, chargingReviewCount] =
    await Promise.all([
      countFor(supabase, "vehicles", user.id),
      countFor(supabase, "caravans", user.id),
      countFor(supabase, "saved_routes", user.id),
      countFor(supabase, "favorites", user.id),
      countFor(supabase, "campsite_reviews", user.id),
      countFor(supabase, "charging_reviews", user.id),
    ]);

  const cards = [
    { href: "/profil/daten", title: "Meine Daten", description: user.email ?? "" },
    {
      href: "/profil/gespann",
      title: "Mein Gespann",
      description: `${vehicleCount} Elektroauto${vehicleCount === 1 ? "" : "s"}, ${caravanCount} Wohnwagen`,
    },
    {
      href: "/profil/routen",
      title: "Meine Routen",
      description: `${savedRouteCount} gespeicherte Route${savedRouteCount === 1 ? "" : "n"}`,
    },
    {
      href: "/profil/favoriten",
      title: "Favoriten",
      description: `${favoriteCount} gemerkt`,
    },
    {
      href: "/profil/bewertungen",
      title: "Bewertungen",
      description: `${campsiteReviewCount + chargingReviewCount} Bewertung${campsiteReviewCount + chargingReviewCount === 1 ? "" : "en"}`,
    },
    { href: "/profil/einstellungen", title: "Einstellungen", description: "Konto & App" },
    {
      href: "/profil/legende",
      title: "Symbole & Begriffe",
      description: "Alle Icons, Farben und Fachbegriffe der App erklärt",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="rounded-lg border border-black/10 p-4 hover:border-route dark:border-white/10"
        >
          <p className="font-medium">{card.title}</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">{card.description}</p>
        </Link>
      ))}
    </div>
  );
}
