"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Reagiert auf eine CSS-Media-Query (z. B. Breakpoint, `pointer: coarse`,
 * `prefers-reduced-motion`). Nutzt bewusst useSyncExternalStore statt
 * useState+useEffect mit synchronem setState beim Mounten (verletzt sonst
 * react-hooks/set-state-in-effect) -- useSyncExternalStore ist die dafuer
 * vorgesehene React-API fuer extern (hier: vom Browser) verwaltete Werte,
 * inkl. korrektem SSR-Fallback (`window` existiert serverseitig nicht,
 * siehe getServerSnapshot). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
