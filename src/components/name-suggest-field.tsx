"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MIN_QUERY_LENGTH = 3;
const MAX_SUGGESTIONS = 8;

/**
 * Namens-Suchfeld mit Vorschlaegen aus bereits geladenen Namen (Campingplatz-
 * /Ladepunkt-Suche) -- rein clientseitiger Abgleich gegen `options`, keine
 * externe Anfrage noetig (anders als AddressAutocomplete: hier wird gegen
 * unsere eigene DB gesucht, nicht gegen echte Adressen).
 *
 * Zwei Modi: ohne `value`-Prop bleibt es ein unkontrolliertes natives
 * Formularfeld (Campingplatz-Filter, filter-form.tsx) -- ein Klick auf einen
 * Vorschlag sendet das umschliessende Formular sofort ab. Mit `value`/
 * `onCommit` (Ladepunkte-Filter, seit der Umstellung auf Sofort-Chips ohne
 * <form>, siehe charging-station-map-explorer.tsx) wird der Wert vom
 * Aufrufer gehalten; `onCommit` feuert bei Vorschlagsauswahl oder Enter statt
 * eines Formular-Submits.
 */
export function NameSuggestField({
  name,
  defaultValue,
  value: controlledValue,
  onCommit,
  placeholder,
  options,
  className,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onCommit?: (value: string) => void;
  placeholder?: string;
  options: string[];
  className?: string;
}) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) return [];
    return options.filter((o) => o.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }, [value, options]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function setValue(next: string) {
    if (!isControlled) setInternalValue(next);
  }

  function selectSuggestion(suggestion: string, formEl: HTMLFormElement | null) {
    setValue(suggestion);
    setOpen(false);
    if (onCommit) onCommit(suggestion);
    else formEl?.requestSubmit();
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onCommit) {
            e.preventDefault();
            onCommit(value);
            setOpen(false);
          }
        }}
        onFocus={() => setOpen(suggestions.length > 0)}
        placeholder={placeholder}
        autoComplete="off"
        // text-base IMMER zusaetzlich zur aufrufenden className -- ohne
        // mindestens 16px zoomt iOS Safari beim Fokussieren automatisch
        // hinein (siehe address-autocomplete.tsx fuer denselben Fix).
        className={`text-base ${className ?? ""}`}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-line-strong bg-white text-sm shadow-lg dark:bg-neutral-900">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => selectSuggestion(s, e.currentTarget.closest("form"))}
                className="block min-h-11 w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
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
