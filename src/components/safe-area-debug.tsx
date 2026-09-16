"use client";

import { useEffect, useState } from "react";

/**
 * NUR TEMPORAER fuer die laufende Diagnose des weissen Streifens unterhalb
 * der Bottom-Tab-Bar auf iOS (siehe safe-area-sync.tsx) -- zeigt die
 * tatsaechlich vom Geraet gemeldeten Werte direkt auf dem Bildschirm an,
 * damit ein einzelner Screenshot vom iPhone reicht, um weiterzukommen
 * (ohne Mac/Safari-Web-Inspector). Bewusst oben platziert, damit der
 * fragliche Bereich unten im Screenshot frei bleibt. Wieder entfernen,
 * sobald die Ursache gefunden ist.
 */
export function SafeAreaDebug() {
  const [info, setInfo] = useState<string>("messe...");

  useEffect(() => {
    function measure() {
      const probeBottom = document.createElement("div");
      probeBottom.style.cssText = "position:fixed;bottom:0;left:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom)";
      document.body.appendChild(probeBottom);
      const envBottom = getComputedStyle(probeBottom).paddingBottom;
      document.body.removeChild(probeBottom);

      const nav = window.navigator as Navigator & { standalone?: boolean };
      const lines = [
        `env-bottom(probe): ${envBottom}`,
        `--safe-bottom(root): ${getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom") || "(leer)"}`,
        `navigator.standalone: ${String(nav.standalone)}`,
        `display-mode standalone: ${window.matchMedia("(display-mode: standalone)").matches}`,
        `innerHeight: ${window.innerHeight}`,
        `visualViewport.height: ${window.visualViewport?.height ?? "n/a"}`,
        `screen.height: ${window.screen?.height ?? "n/a"}`,
        `devicePixelRatio: ${window.devicePixelRatio}`,
      ];
      setInfo(lines.join(" | "));
    }
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "rgba(255,0,0,0.85)",
        color: "white",
        fontSize: "9px",
        lineHeight: 1.3,
        padding: "2px 4px",
        wordBreak: "break-all",
        pointerEvents: "none",
      }}
    >
      {info}
    </div>
  );
}
