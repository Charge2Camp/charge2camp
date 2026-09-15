import Link from "next/link";
import { ChargingReviewForm } from "@/components/charging-stations/review-form";
import type { Caravan, ChargingReview, Vehicle } from "@/types/database";

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

const CRITERION_LABELS: Record<
  "enough_space_for_rig" | "unobstructed_access" | "no_barrier_or_garage" | "side_mounted_charger",
  string
> = {
  enough_space_for_rig: "Genug Platz",
  unobstructed_access: "Freie Rangierfläche",
  no_barrier_or_garage: "Kein Parkhaus/Schranke",
  side_mounted_charger: "Ladesäule seitlich mit Kabellänge",
};

/** Bewertungsliste + Formular/Hinweis darunter -- gemeinsam genutzt von
 * Detailseite und Bottom-Sheet. `ChargingReviewForm` ist bereits eine
 * eigenstaendige Client-Komponente mit eigener Server Action, hier nur
 * eingebunden. */
export function StationReviewsList({
  reviews,
  isLoggedIn,
  ownReview,
  stationId,
  externalKey,
  vehicles,
  caravans,
  onReviewSubmitted,
}: {
  reviews: ChargingReview[];
  isLoggedIn: boolean;
  ownReview: ChargingReview | undefined;
  stationId: string;
  externalKey: string;
  vehicles: Vehicle[];
  caravans: Caravan[];
  /** Siehe ChargingReviewForm.onSuccess -- nur vom Bottom-Sheet genutzt. */
  onReviewSubmitted?: () => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-semibold">Bewertungen</h2>
      {reviews.length === 0 ? (
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">Noch keine Bewertungen vorhanden.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
              <p className="font-medium">Anhängertauglich: {SUITABLE_LABELS[review.suitable]}</p>
              <p className="text-black/60 dark:text-white/60">
                {review.trailer_length_m && `${review.trailer_length_m} m`}
                {review.trailer_width_m && ` × ${review.trailer_width_m} m`}
                {review.caravan_model && ` · ${review.caravan_model}`}
              </p>
              {review.suitable === "limited" && review.decoupled_parking_possible !== null && (
                <p className="text-black/60 dark:text-white/60">
                  Wohnwagen abkoppeln &amp; in der Nähe parken:{" "}
                  {review.decoupled_parking_possible ? "möglich" : "nicht möglich"}
                </p>
              )}
              {(Object.keys(CRITERION_LABELS) as Array<keyof typeof CRITERION_LABELS>).some(
                (key) => review[key] !== null
              ) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.keys(CRITERION_LABELS) as Array<keyof typeof CRITERION_LABELS>)
                    .filter((key) => review[key] !== null)
                    .map((key) => (
                      <span
                        key={key}
                        className={`rounded-full px-2 py-0.5 text-xs text-white ${
                          review[key] ? "bg-route" : "bg-red-600"
                        }`}
                      >
                        {review[key] ? "✓" : "✗"} {CRITERION_LABELS[key]}
                      </span>
                    ))}
                </div>
              )}
              {review.comment && <p className="mt-1 text-black/70 dark:text-white/70">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {!isLoggedIn ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            <Link href="/login" className="text-route hover:underline">
              Anmelden
            </Link>{" "}
            um eine Bewertung abzugeben.
          </p>
        ) : ownReview ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Du hast diesen Ladepunkt bereits bewertet ({SUITABLE_LABELS[ownReview.suitable]}).
          </p>
        ) : (
          <ChargingReviewForm
            stationId={stationId}
            externalKey={externalKey}
            vehicles={vehicles}
            caravans={caravans}
            onSuccess={onReviewSubmitted}
          />
        )}
      </div>
    </section>
  );
}
