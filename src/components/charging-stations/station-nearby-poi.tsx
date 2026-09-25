import {
  NEARBY_POI_CATEGORY_LABELS as CATEGORY_LABELS,
  NEARBY_POI_CATEGORY_ORDER as CATEGORY_ORDER,
  type NearbyPoiByCategory,
} from "@/lib/nearby-poi";
import type { NearbyPoi } from "@/lib/providers/nearby-poi/types";

function formatDistance(distanceM: number): string {
  return distanceM < 1000 ? `${Math.round(distanceM / 10) * 10} m` : `${(distanceM / 1000).toFixed(1)} km`;
}

/** "In der Nähe" (Nutzerwunsch): Toilette/Restaurant/Campingfachmarkt/
 * Campingplatz im Fussweg-Umkreis der Ladesäule, siehe lib/nearby-poi.ts.
 * status="unavailable" (Overpass-Anfrage fehlgeschlagen) wird ehrlich als
 * solches angezeigt statt eine leere Liste vorzutäuschen. */
export function StationNearbyPoi({
  result,
}: {
  result: { status: "ok"; byCategory: NearbyPoiByCategory } | { status: "unavailable" };
}) {
  if (result.status === "unavailable") {
    return (
      <section>
        <h2 className="font-semibold">In der Nähe</h2>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          Umgebungsinfos gerade nicht verfügbar -- bitte später erneut versuchen.
        </p>
      </section>
    );
  }

  const categoriesWithHits = CATEGORY_ORDER.filter((c) => result.byCategory[c].length > 0);
  if (categoriesWithHits.length === 0) {
    return (
      <section>
        <h2 className="font-semibold">In der Nähe</h2>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          Keine Toilette, kein Restaurant, Campingfachmarkt oder Campingplatz im Umkreis von 1 km auf OpenStreetMap
          gefunden.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-semibold">In der Nähe</h2>
      <p className="mt-1 text-xs text-black/40 dark:text-white/40">
        Umkreis 1 km, Datenquelle OpenStreetMap -- Vollständigkeit nicht garantiert.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {categoriesWithHits.map((category) => (
          <div key={category}>
            <p className="text-sm font-medium">{CATEGORY_LABELS[category]}</p>
            <ul className="mt-1 space-y-1 text-sm text-black/70 dark:text-white/70">
              {result.byCategory[category].map((poi: NearbyPoi) => (
                <li key={poi.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{poi.name ?? CATEGORY_LABELS[category]}</span>
                  <span className="shrink-0 text-xs text-black/50 dark:text-white/50">
                    {formatDistance(poi.distanceM)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
