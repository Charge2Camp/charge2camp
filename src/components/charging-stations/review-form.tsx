"use client";

import { useMemo, useState } from "react";
import { addChargingReview } from "@/app/ladepunkte/[id]/actions";
import { CriterionField } from "@/components/charging-stations/criterion-field";
import { FormError } from "@/components/form-error";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Caravan, Vehicle } from "@/types/database";

export function ChargingReviewForm({
  stationId,
  externalKey,
  vehicles,
  caravans,
  onSuccess,
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
  /** Nach erfolgreichem Speichern -- auf der Detailseite reicht das
   * automatische Next.js-Router-Refresh (revalidatePath trifft dort direkt
   * die aktuelle Route), im Bottom-Sheet der Kartenansicht (andere Route,
   * Daten kommen per Client-Fetch) sonst bleibt die Anzeige veraltet stehen,
   * ohne dass ein Fehler sichtbar waere. Optional, Detailseite laesst es weg. */
  onSuccess?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte.
  const [pending, setPending] = useState(false);
  const [suitable, setSuitable] = useState<"yes" | "limited" | "no">("yes");
  const [decoupledParkingPossible, setDecoupledParkingPossible] = useState("");
  const [driveThrough, setDriveThrough] = useState("");
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
        setPending(true);
        try {
          const result = await addChargingReview(formData);
          if (!result.ok) setError(result.error);
          else onSuccess?.();
        } finally {
          setPending(false);
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-line p-4"
    >
      <input type="hidden" name="charging_station_id" value={stationId} />
      <input type="hidden" name="charge_point_external_key" value={externalKey} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="caravan_id" value={caravanId} />

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">
          Ist dieser Ladepunkt mit deinem Gespann nutzbar?
        </legend>
        <label className="flex min-h-11 items-center gap-2">
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
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="limited"
            checked={suitable === "limited"}
            onChange={() => setSuitable("limited")}
          />
          Mit Einschränkungen
        </label>
        <label className="flex min-h-11 items-center gap-2">
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
        <fieldset className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          <legend className="mb-1 font-medium">
            Kannst du den Wohnwagen abkoppeln und bequem in unmittelbarer Nähe der Ladesäule
            parken, während das Zugfahrzeug lädt?
          </legend>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="yes"
              checked={decoupledParkingPossible === "yes"}
              onChange={() => setDecoupledParkingPossible("yes")}
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
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

      {suitable === "yes" && (
        <fieldset className="flex flex-col gap-1 rounded-md border border-line p-3 text-sm">
          <legend className="mb-1 font-medium">
            Konntest du mit dem Gespann durchfahren, ohne rangieren oder rückwärtsfahren zu
            müssen (Drive-Through)?
          </legend>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="drive_through"
              value="yes"
              checked={driveThrough === "yes"}
              onChange={() => setDriveThrough("yes")}
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="drive_through"
              value="no"
              checked={driveThrough === "no"}
              onChange={() => setDriveThrough("no")}
            />
            Nein
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="drive_through"
              value=""
              checked={driveThrough === ""}
              onChange={() => setDriveThrough("")}
            />
            Weiß nicht
          </label>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-line p-3">
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
      {vehicles.length === 0 && caravans.length === 0 && (
        // UX-05.4 (docs/design/ux-problems.md): ohne hinterlegtes Gespann
        // faellt diese Auswahl sonst kommentarlos auf "Sonstiges / manuell"
        // zurueck -- der Komfortgewinn eines hinterlegten Gespanns
        // (automatische Laengen-/Breitenberechnung unten, s. recompute())
        // blieb dadurch unentdeckt.
        <p className="text-sm text-warning">
          Trag dein Gespann unter{" "}
          <a href="/profil/gespann" className="underline">
            Mein Gespann
          </a>{" "}
          ein, dann musst du Länge und Breite nicht jedes Mal von Hand eingeben.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Auto (aus deinem Profil)">
          <Select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              recompute(e.target.value, caravanId);
            }}
          >
            <option value="">Sonstiges / manuell</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.manufacturer} {v.model}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Wohnwagen (aus deinem Profil)">
          <Select
            value={caravanId}
            onChange={(e) => {
              setCaravanId(e.target.value);
              recompute(vehicleId, e.target.value);
            }}
          >
            <option value="">Sonstiges / manuell</option>
            {caravans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Gespannlänge gesamt (m)">
          <Input
            name="trailer_length_m"
            type="number"
            step="0.01"
            min="0"
            value={trailerLengthM}
            onChange={(e) => setTrailerLengthM(e.target.value)}
          />
        </Field>
        <Field label="Gespannbreite (m)">
          <Input
            name="trailer_width_m"
            type="number"
            step="0.01"
            min="0"
            value={trailerWidthM}
            onChange={(e) => setTrailerWidthM(e.target.value)}
          />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-text-muted">
        Bei Auswahl von Auto + Wohnwagen automatisch berechnet (Fahrzeuglänge + Wohnwagenlänge),
        bei Bedarf anpassbar.
      </p>

      <Field label="Wohnwagenmodell (optional)">
        <Input name="caravan_model" value={caravanModel} onChange={(e) => setCaravanModel(e.target.value)} />
      </Field>

      <Field label="Kommentar (optional)">
        <Textarea name="comment" rows={3} />
      </Field>

      {error && <FormError className="text-sm">{error}</FormError>}

      <Button type="submit" size="md" disabled={pending} className="self-start">
        {pending ? "Wird gesendet…" : "Bewertung abschicken"}
      </Button>
    </form>
  );
}
