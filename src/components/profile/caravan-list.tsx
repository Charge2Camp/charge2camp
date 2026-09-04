import type { Caravan } from "@/types/database";
import { deleteCaravan } from "@/app/profil/actions";

export function CaravanList({ caravans }: { caravans: Caravan[] }) {
  if (caravans.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Noch kein Wohnwagen hinterlegt.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {caravans.map((caravan) => (
        <li
          key={caravan.id}
          className="flex items-center justify-between gap-4 rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
        >
          <div className="text-sm">
            <p className="font-medium">
              {caravan.manufacturer} {caravan.model}
            </p>
            <p className="text-black/60 dark:text-white/60">
              {caravan.length_m} × {caravan.width_m} × {caravan.height_m} m · {caravan.weight_kg} kg
              {caravan.gross_vehicle_weight_kg ? ` · zGG ${caravan.gross_vehicle_weight_kg} kg` : ""}
              {caravan.actual_travel_weight_kg ? ` · Reisegewicht ${caravan.actual_travel_weight_kg} kg` : ""}
            </p>
          </div>
          <form action={deleteCaravan}>
            <input type="hidden" name="id" value={caravan.id} />
            <button
              type="submit"
              className="text-sm text-red-600 hover:underline"
              aria-label={`${caravan.manufacturer} ${caravan.model} entfernen`}
            >
              Entfernen
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
