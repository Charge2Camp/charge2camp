import Link from "next/link";
import type { CampsiteSearchRow } from "@/types/database";

/** Kompakte Favoriten-Kurzliste, direkt unter den Filtern, unabhaengig von
 * aktiven Suchfiltern immer sichtbar (Nutzeranfrage) -- reiner Server-
 * Component-Teilbaum (keine Interaktion ausser Links), als `children` in
 * campsite-search-client.tsx eingehaengt, damit dieser Teil serverseitig
 * gerendert bleibt statt Teil des Client-Bundles zu werden. Ersetzt die
 * bisherige Rolle der Favoriten als STANDARD-Ergebnisliste ohne aktive
 * Filter (siehe DESIGN_DECISIONS.md) -- die Ergebnisliste selbst zeigt jetzt
 * ausschliesslich echte Filterergebnisse. */
export function FavoritesQuickList({ favorites }: { favorites: CampsiteSearchRow[] }) {
  if (favorites.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-muted">
        Deine Favoriten ({favorites.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {favorites.map((c) => (
          <li key={c.id}>
            <Link
              href={`/campingplaetze/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-sm text-text-muted">
                  {[c.city, c.country_code].filter(Boolean).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {c.charging_on_site && (
                  <span className="rounded-full bg-route/10 px-2 py-1 text-route">Ladepunkt</span>
                )}
                <span className="rounded-full border border-line-strong px-2 py-1 font-medium">
                  {c.ev_score}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
