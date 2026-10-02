"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 300;

/**
 * Namens-Suchfeld mit Vorschlaegen aus bereits geladenen Namen (Campingplatz-
 * /Ladepunkt-Suche) -- rein clientseitiger Abgleich gegen `options`, keine
 * externe Anfrage noetig (anders als AddressAutocomplete: hier wird gegen
 * unsere eigene DB gesucht, nicht gegen echte Adressen).
 *
 * Vorschlagsquelle: entweder `options` (vorgeladene Liste, rein clientseitig
 * gefiltert -- Ladepunkt-Suche) oder `fetchSuggestions` (debounced
 * serverseitige Suche ab drei Zeichen -- Campingplatz-Suche, damit keine
 * komplette Namensliste mehr an den Client geht und bei EU-Datenmenge keine
 * Namen abgeschnitten werden). `fetchSuggestions` hat Vorrang. Nur in diesem
 * Modus gibt es Leer-/Fehlerhinweise (`emptyMessage`/`errorMessage`).
 *
 * Zwei Modi: ohne `value`-Prop bleibt es ein unkontrolliertes natives
 * Formularfeld (Campingplatz-Filter, filter-form.tsx) -- ein Klick auf einen
 * Vorschlag sendet das umschliessende Formular sofort ab. Mit `value`/
 * `onCommit` (Ladepunkte-Filter, seit der Umstellung auf Sofort-Chips ohne
 * <form>, siehe charging-station-map-explorer.tsx) meldet `onCommit` den
 * Wert bei Vorschlagsauswahl oder Enter an den Aufrufer zurueck.
 *
 * Die Eingabe selbst bleibt dabei IMMER interner State (`value`-State unten),
 * NICHT direkt an die `value`-Prop gebunden -- ein waehrend jedes Tastendrucks
 * voll kontrolliertes Feld ohne begleitendes onChange wuerde React den
 * angezeigten Wert bei jedem Render auf die (unveraenderte) Prop zuruecksetzen
 * lassen, das Feld waere effektiv unbeschreibbar (genau das ist beim ersten
 * Versuch dieser Umstellung passiert). Die `value`-Prop dient stattdessen nur
 * als EXTERNES Reset-Signal (z. B. nach "Zuruecksetzen", siehe
 * charging-station-map-explorer.tsx resetFilters) -- der Effekt unten
 * synchronisiert nur bei einer Aenderung dieser Prop von aussen.
 *
 * Bedienung/Barrierefreiheit: Combobox-ARIA (role="combobox", listbox/option,
 * aria-activedescendant), Pfeiltasten wählen einen Vorschlag, Enter übernimmt
 * ihn, Escape schliesst die Liste (gleiches Muster wie address-autocomplete.tsx).
 */
export function NameSuggestField({
  name,
  defaultValue,
  value: externalValue,
  onCommit,
  placeholder,
  options = [],
  fetchSuggestions,
  emptyMessage,
  errorMessage,
  className,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onCommit?: (value: string) => void;
  placeholder?: string;
  options?: string[];
  /** Serverseitige Vorschlagssuche (mind. 3 Zeichen, debounced); ersetzt `options`. */
  fetchSuggestions?: (query: string, signal: AbortSignal) => Promise<string[]>;
  /** Hinweis unter dem Feld, wenn die serverseitige Suche NICHTS gefunden hat
   * (nur mit `fetchSuggestions`). Ohne Angabe bleibt die Anzeige leer. */
  emptyMessage?: string;
  /** Hinweis unter dem Feld, wenn die serverseitige Suche fehlgeschlagen ist
   * (Netz, Rate-Limit, Serverfehler) -- sonst wirkt ein Fehler wie "kein
   * Treffer". Nur mit `fetchSuggestions`. */
  errorMessage?: string;
  className?: string;
}) {
  const [value, setValue] = useState(externalValue ?? defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [remoteSuggestions, setRemoteSuggestions] = useState<string[]>([]);
  // Fuer welche (getrimmte) Eingabe die letzte Anfrage abgeschlossen wurde und
  // ob sie fehlschlug -- Leer-/Fehlerhinweis erscheinen nur, wenn das zur
  // AKTUELLEN Eingabe passt, nicht waehrend noch getippt/geladen wird.
  const [settled, setSettled] = useState<{ query: string; failed: boolean } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listId = useId();
  const requestIdRef = useRef(0);
  // Eine ausgewaehlte Suggestion aendert `value` und wuerde sonst sofort eine
  // neue Abfrage fuer den gerade gewaehlten Text ausloesen.
  const suppressNextFetchRef = useRef(false);

  // Mikrotask-entkoppelt statt synchron im Effect-Body (react-hooks/
  // set-state-in-effect), gleiches Muster wie an anderer Stelle im Projekt
  // (siehe charging-station-map-explorer.tsx).
  useEffect(() => {
    if (externalValue !== undefined) void Promise.resolve().then(() => setValue(externalValue));
  }, [externalValue]);

  const localSuggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) return [];
    return options.filter((o) => o.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }, [value, options]);

  // Serverantworten bleiben waehrend des Weitertippens sichtbar, werden aber
  // sofort auf die aktuelle Eingabe zugeschnitten -- so bietet die Liste nie
  // Namen an, die den gerade getippten Text gar nicht mehr enthalten.
  const trimmedValue = value.trim();
  const filteredRemote = useMemo(() => {
    const query = trimmedValue.toLowerCase();
    return remoteSuggestions.filter((o) => o.toLowerCase().includes(query));
  }, [remoteSuggestions, trimmedValue]);
  const suggestions = fetchSuggestions ? filteredRemote : localSuggestions;
  const listVisible = open && suggestions.length > 0;
  const activeIndex = highlightedIndex < suggestions.length ? highlightedIndex : -1;

  const settledForCurrent =
    Boolean(fetchSuggestions) && settled?.query === trimmedValue && trimmedValue.length >= MIN_QUERY_LENGTH;
  let hint: string | null = null;
  if (open && settledForCurrent) {
    if (settled?.failed) hint = errorMessage ?? null;
    else if (remoteSuggestions.length === 0) hint = emptyMessage ?? null;
  }

  useEffect(() => {
    if (!fetchSuggestions) return;
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false;
      return;
    }
    const query = value.trim();
    const requestId = ++requestIdRef.current;
    // Beim naechsten Tastendruck/Unmount wird die laufende Anfrage ABGEBROCHEN
    // (nicht nur ihre Antwort ignoriert), damit der Server fuer verworfene
    // Eingaben keine Arbeit mehr leistet.
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      if (query.length < MIN_QUERY_LENGTH) {
        setRemoteSuggestions([]);
        setSettled(null);
        return;
      }
      try {
        const results = await fetchSuggestions(query, controller.signal);
        if (requestIdRef.current !== requestId) return; // veraltete Antwort ignorieren
        setRemoteSuggestions(results.slice(0, MAX_SUGGESTIONS));
        setSettled({ query, failed: false });
      } catch {
        // Vorschlaege sind nur eine Komfortfunktion -- das Feld bleibt frei
        // beschreibbar und absendbar; ein Fehler zeigt den errorMessage-Hinweis
        // statt einer Liste. Ein Abbruch durch neue Eingabe ist kein Fehler.
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        setRemoteSuggestions([]);
        setSettled({ query, failed: true });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(suggestion: string, formEl: HTMLFormElement | null) {
    // Nur wenn sich `value` wirklich aendert -- sonst laeuft der Effect nicht
    // und das Flag wuerde die naechste echte Eingabe verschlucken.
    // (Gleiches gilt fuer `fetchSuggestions`: muss referenzstabil sein, z. B.
    // eine Funktion auf Modulebene, sonst feuert der Effect bei jedem Render.)
    suppressNextFetchRef.current = suggestion !== value;
    setRemoteSuggestions([]);
    setSettled(null);
    setHighlightedIndex(-1);
    setValue(suggestion);
    setOpen(false);
    if (onCommit) onCommit(suggestion);
    else formEl?.requestSubmit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlightedIndex(Math.min(activeIndex + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && listVisible) {
      e.preventDefault();
      setHighlightedIndex(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === "Enter") {
      if (listVisible && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex], containerRef.current?.closest("form") ?? null);
      } else if (onCommit) {
        e.preventDefault();
        onCommit(value);
        setOpen(false);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setHighlightedIndex(-1);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listVisible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        // text-base IMMER zusaetzlich zur aufrufenden className -- ohne
        // mindestens 16px zoomt iOS Safari beim Fokussieren automatisch
        // hinein (siehe address-autocomplete.tsx fuer denselben Fix).
        className={`text-base ${className ?? ""}`}
      />
      {fetchSuggestions && (
        // Immer gerendert (ohne Text sr-only), damit Screenreader die
        // Aenderung zuverlaessig ansagen -- eine erst beim Auftreten
        // eingefuegte Live-Region wird oft nicht vorgelesen.
        <p role="status" className={hint ? "mt-1 text-xs text-text-muted" : "sr-only"}>
          {hint}
        </p>
      )}
      {listVisible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line-strong bg-card text-sm shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s} role="presentation">
              <button
                type="button"
                role="option"
                id={`${listId}-${i}`}
                aria-selected={i === activeIndex}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => selectSuggestion(s, e.currentTarget.closest("form"))}
                className={`block min-h-11 w-full px-3 py-2 text-left ${
                  i === activeIndex ? "bg-route/10" : "hover:bg-surface"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
