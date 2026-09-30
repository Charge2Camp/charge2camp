"use client";

import { useState, type FormEvent } from "react";
import type { ManeuveringSpace, TrailerSuitability, TrailerVerdict } from "@/lib/types";

interface Props {
  trailer: TrailerSuitability | null;
  overrideAction: (formData: FormData) => void | Promise<void>;
}

/**
 * Nutzerbefund 2026-09-30 (Hauptapp-Screenshot): ein Ladepunkt zeigte
 * gleichzeitig "Ungeprüft" (Anhängertauglichkeits-Einstufung) UND "Geprüft"
 * (Herkunft/Vertrauenswürdigkeit, origin='admin_override') -- verwirrend,
 * aber datentechnisch kein Widerspruch: ein Admin kann durchaus bewusst
 * "wir haben nachgeschaut, wissen es aber wirklich nicht" festhalten.
 * TATSAECHLICHE Ursache in diesem Fall: das "Einstufung"-Select defaultet
 * bei einer neuen/vorher ungeprueften Station auf "unknown" -- wer beim
 * Bearbeiten nur Drive-Through/Notizen aendert und die Einstufung selbst
 * nicht bewusst umstellt, speichert dadurch stillschweigend "Ungeprüft" als
 * waere es eine echte Bewertung. Da eine manuelle Admin-Korrektur so gut
 * wie nie absichtlich "Ungeprüft" sein soll, fragt dieses Formular vor dem
 * Speichern einmal explizit nach, statt es kommentarlos durchzulassen.
 */
export function TrailerVerdictForm({ trailer, overrideAction }: Props) {
  const [verdict, setVerdict] = useState<TrailerVerdict>(trailer?.verdict ?? "unknown");
  const [confirmingUnknown, setConfirmingUnknown] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (verdict === "unknown" && !confirmingUnknown) {
      e.preventDefault();
      setConfirmingUnknown(true);
    }
    // Sonst: normaler Server-Action-Submit laeuft durch (auch der
    // bestaetigte "unknown"-Fall -- confirmingUnknown bleibt fuer den
    // naechsten Formularaufbau ohnehin durch den Seiten-Reload zurueckgesetzt).
  }

  return (
    <form action={overrideAction} onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Einstufung
        <select
          name="verdict"
          value={verdict}
          onChange={(e) => {
            setVerdict(e.target.value as TrailerVerdict);
            setConfirmingUnknown(false);
          }}
          className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
        >
          <option value="yes">Anhängertauglich</option>
          <option value="unhitch">Nur abgekoppelt erreichbar</option>
          <option value="no">Nicht anhängertauglich</option>
          <option value="unknown">Ungeprüft</option>
        </select>
      </label>
      {confirmingUnknown && (
        <p className="rounded-md border border-status-busy/40 bg-status-busy/5 p-3 text-sm text-status-busy">
          Einstufung bleibt &quot;Ungeprüft&quot; -- das ist als manuelle Admin-Korrektur fast nie beabsichtigt (die
          Station zeigt dann trotz &quot;geprüfter&quot; Herkunft weiterhin keine Anhängertauglichkeits-Einschätzung).
          Nochmal auf &quot;Speichern&quot; tippen, um das trotzdem so zu speichern.
        </p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="drive_through" value="1" defaultChecked={trailer?.drive_through ?? false} />
        Drive-Through (durchfahrbar, kein Rangieren nötig)
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Rangierfläche
          <select
            name="maneuvering_space"
            defaultValue={trailer?.maneuvering_space ?? ("" as ManeuveringSpace | "")}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          >
            <option value="">Unbekannt</option>
            <option value="ample">Ausreichend</option>
            <option value="tight">Eng</option>
            <option value="none">Keine</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Einfahrlänge (m)
          <input
            type="number"
            step="0.1"
            name="pull_in_length_m"
            defaultValue={trailer?.pull_in_length_m ?? ""}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-base"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Notizen
        <textarea
          name="notes"
          defaultValue={trailer?.notes ?? ""}
          rows={3}
          className="rounded-md border border-line px-3 py-2 text-base"
        />
      </label>
      <button type="submit" className="min-h-11 self-start rounded-md bg-action px-4 text-sm font-medium hover:bg-action-hover">
        {confirmingUnknown ? "Trotzdem als Ungeprüft speichern" : "Anhängertauglichkeit speichern"}
      </button>
    </form>
  );
}
