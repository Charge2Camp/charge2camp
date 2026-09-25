"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchAddressSuggestions, type AddressSuggestion } from "@/lib/providers/geocoding/photon";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;
const MAX_LOCAL_SUGGESTIONS = 5;

export interface LocalSuggestion {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * Adressfeld mit Vorschlaegen waehrend der Eingabe (ab drei Zeichen,
 * debounced) ueber Photon (siehe photon.ts) -- dient sowohl der
 * Tipp-Unterstuetzung als auch einer informellen Korrektheitspruefung: nur
 * von einem echten Geocoder erkannte Orte tauchen als Vorschlag auf. Ein
 * ausgewaehlter Vorschlag (Photon-Treffer oder `localSuggestions`) liefert
 * ueber `onSelectCoordinates` bereits bekannte Koordinaten -- die aufrufende
 * Stelle kann sie direkt uebernehmen und so ein erneutes Geocoding beim
 * Absenden vermeiden (siehe actions.ts). Das ist wichtig, weil eine zweite
 * Geocoding-Runde (z. B. ueber Nominatim) das bereits ausgewaehlte Ergebnis
 * verfaelschen kann -- etwa die Hausnummer stillschweigend weglassen, wenn
 * die exakte Adresse in den OSM-Daten des zweiten Geocoders anders indexiert
 * ist als bei Photon. Wird kein Vorschlag ausgewaehlt (freie Texteingabe),
 * bleibt die Aufloesung wie gehabt Aufgabe der aufrufenden Stelle.
 *
 * `localSuggestions` (z. B. unsere eigenen Campingplaetze) werden zusaetzlich
 * ohne Debounce/Netzwerk rein clientseitig gefiltert, zuerst und farblich
 * abgesetzt angezeigt -- wichtig u. a., weil z. B. Demo-Campingplatznamen
 * ("[DEMO] ...") ueber einen echten Geocoder gar nicht auffindbar waeren.
 */
export function AddressAutocomplete({
  name,
  value,
  onChange,
  placeholder,
  required,
  className,
  localSuggestions = [],
  localSuggestionLabel = "Unser Campingplatz",
  onSelectCoordinates,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  localSuggestions?: LocalSuggestion[];
  localSuggestionLabel?: string;
  onSelectCoordinates?: (coords: { latitude: number; longitude: number } | null) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  // UX-Audit (2026-09-24): ein fehlgeschlagener Vorschlag-Abruf blieb bisher
  // komplett unsichtbar (leere Liste, kein Hinweis) -- wirkte fuer den
  // Nutzer wie "diese Adresse gibt es nicht", statt wie ein Netzwerkproblem.
  const [suggestFailed, setSuggestFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Verhindert, dass das Auswaehlen eines Vorschlags (aendert `value`, loest
  // also den Effect erneut aus) sofort eine neue Vorschlagsliste fuer den
  // gerade erst ausgewaehlten Text oeffnet.
  const suppressNextSearchRef = useRef(false);

  const localMatches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) return [];
    return localSuggestions
      .filter((s) => s.displayName.toLowerCase().includes(query))
      .slice(0, MAX_LOCAL_SUGGESTIONS);
  }, [value, localSuggestions]);

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    const query = value.trim();
    const requestId = ++requestIdRef.current;

    const timeout = setTimeout(async () => {
      if (query.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setSuggestFailed(false);
        return;
      }
      try {
        const results = await searchAddressSuggestions(query);
        if (requestIdRef.current !== requestId) return; // veraltete Antwort ignorieren
        setSuggestions(results);
        setSuggestFailed(false);
        setHighlightedIndex(-1);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
        setSuggestFailed(true);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lokale und Photon-Vorschlaege in einer gemeinsamen, tastaturnavigierbaren
  // Liste -- lokale zuerst (relevanter fuer unsere Plattform), farblich
  // abgesetzt.
  const combinedItems = useMemo(
    () => [
      ...localMatches.map((s) => ({ type: "local" as const, suggestion: s })),
      ...suggestions.map((s) => ({ type: "remote" as const, suggestion: s })),
    ],
    [localMatches, suggestions]
  );
  const hasSuggestions = combinedItems.length > 0;

  function selectLocal(suggestion: LocalSuggestion) {
    suppressNextSearchRef.current = true;
    onChange(suggestion.displayName);
    onSelectCoordinates?.({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setOpen(false);
    setSuggestions([]);
  }

  function selectRemote(suggestion: AddressSuggestion) {
    suppressNextSearchRef.current = true;
    onChange(suggestion.displayName);
    onSelectCoordinates?.({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || combinedItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, combinedItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        const item = combinedItems[highlightedIndex];
        if (item.type === "local") selectLocal(item.suggestion);
        else selectRemote(item.suggestion);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        type="text"
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onSelectCoordinates?.(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        // text-base IMMER zusaetzlich zur aufrufenden className (nicht nur
        // dort, wo sie gerade dran denkt) -- ohne mindestens 16px zoomt iOS
        // Safari beim Fokussieren automatisch hinein (siehe CLAUDE.md
        // Mobile/Touch-Design). Aktuell setzen zwar alle Aufrufer das
        // selbst, aber dieses Feld soll das nicht stillschweigend
        // voraussetzen muessen.
        className={`text-base ${className ?? ""}`}
      />
      {open && suggestFailed && localMatches.length === 0 && (
        <p className="mt-1 text-xs text-text-muted">
          Adressvorschläge gerade nicht verfügbar -- Adresse kann trotzdem frei eingegeben werden.
        </p>
      )}
      {open && hasSuggestions && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-black/15 bg-white text-sm shadow-lg dark:border-white/15 dark:bg-neutral-900">
          {combinedItems.map((item, i) => (
            <li key={item.type === "local" ? `local-${item.suggestion.id}` : `remote-${i}`}>
              <button
                type="button"
                // Verhindert, dass das Input vor dem Klick den Blur-Handler
                // ausloest und die Liste schon schliesst, bevor onClick feuert.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (item.type === "local" ? selectLocal(item.suggestion) : selectRemote(item.suggestion))}
                className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left ${
                  i === highlightedIndex ? "bg-route/10" : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {item.type === "local" && (
                  <span className="shrink-0 rounded-full bg-route/15 px-1.5 py-0.5 text-xs text-route">
                    {localSuggestionLabel}
                  </span>
                )}
                <span className="truncate">{item.suggestion.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
