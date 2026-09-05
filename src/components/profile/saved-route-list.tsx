import type { SavedRoute } from "@/types/database";
import { deleteSavedRoute } from "@/app/profil/actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export function SavedRouteList({ routes }: { routes: SavedRoute[] }) {
  if (routes.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Noch keine Route gespeichert. Im{" "}
        <a href="/routenplaner" className="underline">
          Routenplaner
        </a>{" "}
        kannst du eine geplante Route speichern.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {routes.map((route) => (
        <li
          key={route.id}
          className="flex items-center justify-between gap-4 rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
        >
          <div className="text-sm">
            <p className="font-medium">{route.name}</p>
            <p className="text-black/60 dark:text-white/60">
              {route.start_display_name} → {route.end_display_name}
            </p>
            <p className="text-xs text-black/40 dark:text-white/40">Gespeichert am {formatDate(route.created_at)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a
              href={`/routenplaner?savedRouteId=${route.id}`}
              className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Öffnen
            </a>
            <form action={deleteSavedRoute}>
              <input type="hidden" name="id" value={route.id} />
              <button
                type="submit"
                className="text-sm text-red-600 hover:underline"
                aria-label={`Route "${route.name}" entfernen`}
              >
                Entfernen
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
