import Link from "next/link";
import {
  PERSONAL_COMPATIBILITY_LABELS,
  type CommunitySuitabilitySummary,
  type PersonalCompatibility,
} from "@/lib/scoring/trailer-compatibility";

/** Gespann-Kompatibilitaets-Zusammenfassung (Community-Text + persoenliche
 * Einschaetzung) -- bewusst OHNE das Gespannlaengen-Diagramm
 * (RigLengthDistributionChart bleibt ein eigener Baustein, siehe
 * Aufrufer), da Detailseite und Bottom-Sheet die beiden Teile
 * unterschiedlich anordnen (Detailseite: Zusammenfassung neben
 * "Technische Daten", Diagramm separat volle Breite darunter;
 * Bottom-Sheet: beides direkt untereinander). Arbeitet ausschliesslich mit
 * bereits berechneten Werten (siehe fetchChargingStationDetailExtras). */
export function StationCompatibilitySummary({
  communitySummary,
  personalCompatibility,
  isLoggedIn,
}: {
  communitySummary: CommunitySuitabilitySummary;
  personalCompatibility: PersonalCompatibility;
  isLoggedIn: boolean;
}) {
  return (
    <section>
      <h2 className="font-semibold">Gespann-Kompatibilität</h2>
      <p className="mt-2 text-sm">{communitySummary.summary}</p>
      {communitySummary.overallPositiveRatio !== null && (
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {Math.round(communitySummary.overallPositiveRatio * 100)}% positive Rückmeldungen ·{" "}
          {communitySummary.reviewCount} Bewertungen
        </p>
      )}

      <div className="mt-4 rounded-lg border border-route/30 bg-route/5 p-3 text-sm font-medium text-route">
        {PERSONAL_COMPATIBILITY_LABELS[personalCompatibility]}
        {personalCompatibility === "keine_daten" && !isLoggedIn && (
          <span className="mt-1 block text-xs font-normal text-black/50 dark:text-white/50">
            <Link href="/login" className="text-route hover:underline">
              Anmelden
            </Link>{" "}
            und Wohnwagen im Profil hinterlegen für eine persönliche Einschätzung.
          </span>
        )}
      </div>
    </section>
  );
}
