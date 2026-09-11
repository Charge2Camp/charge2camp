"use client";

import { useMemo, useState } from "react";
import { addChargingReview } from "@/app/ladepunkte/[id]/actions";
import { CriterionField } from "@/components/charging-stations/criterion-field";
import type { Caravan, Vehicle } from "@/types/database";

export function ChargingReviewForm({
  stationId,
  externalKey,
  vehicles,
  caravans,
}: {
  stationId: string;
  /** core.charge_point.external_key -- enrich.trailer_suitability/
   * enrich.trailer_report sind ueber diesen Schluessel verknuepft, nicht
   * ueber die UUID (siehe addChargingReview: speist die Antwort auf "Ist
   * dieser Ladepunkt mit deinem Gespann nutzbar?" zusaetzlich in die
   * Anhaengertauglichkeits-Meldewarteschlange ein). */
  externalKey: string;
  vehicles: Vehicle[];
  caravans: Caravan[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [suitable, setSuitable] = useState<"yes" | "limited" | "no">("yes");
  const [decoupledParkingPossible, setDecoupledParkingPossible] = useState("");
  const [enoughSpaceForRig, setEnoughSpaceForRig] = useState("");
  const [unobstructedAccess, setUnobstructedAccess] = useState("");
  const [noBarrierOrGarage, setNoBarrierOrGarage] = useState("");
  const [sideMountedCharger, setSideMountedCharger] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [caravanId, setCaravanId] = useState("");
  const [trailerLengthM, setTrailerLengthM] = useState("");
  const [trailerWidthM, setTrailerWidthM] = useState("");
  const [caravanModel, setCaravanModel] = useState("");

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const caravanById = useMemo(() => new Map(caravans.map((c) => [c.id, c])), [caravans]);

  function recompute(nextVehicleId: string, nextCaravanId: string) {
    const vehicle = vehicleById.get(nextVehicleId);
    const caravan = caravanById.get(nextCaravanId);

    if (vehicle?.length_m != null && caravan?.length_m != null) {
      setTrailerLengthM((vehicle.length_m + caravan.length_m).toFixed(2));
    } else if (caravan?.length_m != null) {
      setTrailerLengthM(caravan.length_m.toString());
    }
    if (caravan?.width_m != null) setTrailerWidthM(caravan.width_m.toString());
    if (caravan) setCaravanModel(`${caravan.manufacturer} ${caravan.model}`);
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await addChargingReview(formData);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Bewertung konnte nicht gespeichert werden.");
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <input type="hidden" name="charging_station_id" value={stationId} />
      <input type="hidden" name="charge_point_external_key" value={externalKey} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="caravan_id" value={caravanId} />

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">
          Ist dieser Ladepunkt mit deinem Gespann nutzbar?
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="yes"
            checked={suitable === "yes"}
            onChange={() => setSuitable("yes")}
            required
          />
          Ja
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="limited"
            checked={suitable === "limited"}
            onChange={() => setSuitable("limited")}
          />
          Mit Einschränkungen
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="no"
            checked={suitable === "no"}
            onChange={() => setSuitable("no")}
          />
          Nein
        </label>
      </fieldset>

      {suitable === "limited" && (
        <fieldset className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <legend className="mb-1 font-medium">
            Kannst du den Wohnwagen abkoppeln und bequem in unmittelbarer Nähe der Ladesäule
            parken, während das Zugfahrzeug lädt?
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="yes"
              checked={decoupledParkingPossible === "yes"}
              onChange={() => setDecoupledParkingPossible("yes")}
            />
            Ja
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="no"
              checked={decoupledParkingPossible === "no"}
              onChange={() => setDecoupledParkingPossible("no")}
            />
            Nein
          </label>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium">
          Details zur Durchfahrt (optional, hilft anderen bei der Einschätzung)
        </p>
        <CriterionField
          name="enough_space_for_rig"
          label="Genug Platz für Gespann?"
          value={enoughSpaceForRig}
          onChange={setEnoughSpaceForRig}
        />
        <CriterionField
          name="unobstructed_access"
          label="Freie Rangierfläche ohne Hindernisse?"
          value={unobstructedAccess}
          onChange={setUnobstructedAccess}
        />
        <CriterionField
          name="no_barrier_or_garage"
          label="Kein Parkhaus / keine Schranke?"
          value={noBarrierOrGarage}
          onChange={setNoBarrierOrGarage}
        />
        <CriterionField
          name="side_mounted_charger"
          label="Kabel an Säulen in ausreichender Länge?"
          value={sideMountedCharger}
          onChange={setSideMountedCharger}
        />
      </div>

      <p className="text-sm font-medium">Mit welchem Gespann warst du hier?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Auto (aus deinem Profil)
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              recompute(e.target.value, caravanId);
            }}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Sonstiges / manuell</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.manufacturer} {v.model}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Wohnwagen (aus deinem Profil)
          <select
            value={caravanId}
            onChange={(e) => {
              setCaravanId(e.target.value);
              recompute(vehicleId, e.target.value);
            }}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Sonstiges / manuell</option>
            {caravans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Gespannlänge gesamt (m)
          <input
            name="trailer_length_m"
            type="number"
            step="0.01"
            min="0"
            value={trailerLengthM}
            onChange={(e) => setTrailerLengthM(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gespannbreite (m)
          <input
            name="trailer_width_m"
            type="number"
            step="0.01"
            min="0"
            value={trailerWidthM}
            onChange={(e) => setTrailerWidthM(e.target.value)}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-black/40 dark:text-white/40">
        Bei Auswahl von Auto + Wohnwagen automatisch berechnet (Fahrzeuglänge + Wohnwagenlänge),
        bei Bedarf anpassbar.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Wohnwagenmodell (optional)
        <input
          name="caravan_model"
          value={caravanModel}
          onChange={(e) => setCaravanModel(e.target.value)}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Kommentar (optional)
        <textarea
          name="comment"
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="min-h-12 self-start rounded-md bg-action px-4 py-3 text-sm font-medium text-base hover:bg-action-hover"
      >
        Bewertung abschicken
      </button>
    </form>
  );
}
