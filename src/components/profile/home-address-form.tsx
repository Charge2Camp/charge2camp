"use client";

import { useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { setHomeAddress } from "@/app/profil/actions";

export function HomeAddressForm({ initialAddress }: { initialAddress: string }) {
  const [value, setValue] = useState(initialAddress);
  // Gesetzt, wenn ein Photon-Vorschlag ausgewaehlt wurde -- dann sind
  // Koordinaten UND die praezise (inkl. Hausnummer) formatierte Adresse
  // schon bekannt und werden unveraendert gespeichert. Ohne das wuerde
  // setHomeAddress den Text erneut ueber Nominatim geocodieren, dessen
  // Ergebnis die Hausnummer je nach OSM-Datenlage abweichend formatiert
  // oder sogar weglaesst (Str./Hausnummer-Genauigkeit nicht immer in
  // Nominatims Adress-Suche vorhanden), siehe actions.ts.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  return (
    <form action={setHomeAddress} className="mt-2 flex max-w-md flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Zuhause-Adresse
        <AddressAutocomplete
          name="home_address"
          value={value}
          onChange={setValue}
          onSelectCoordinates={setCoords}
          placeholder="z. B. Musterstraße 1, 12345 Musterstadt"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
        {coords && (
          <>
            <input type="hidden" name="home_latitude" value={coords.latitude} />
            <input type="hidden" name="home_longitude" value={coords.longitude} />
          </>
        )}
      </label>
      <button
        type="submit"
        className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
      >
        Speichern
      </button>
    </form>
  );
}
