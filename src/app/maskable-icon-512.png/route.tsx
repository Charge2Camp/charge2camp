import { ImageResponse } from "next/og";

export const contentType = "image/png";

// Maskable-Variante (purpose: "maskable" in manifest.ts) fuer Android
// Adaptive Icons -- das Betriebssystem kann JEDE Form (Kreis, Rundraute,
// abgerundetes Quadrat, ...) aus dem vollflaechigen Hintergrund
// ausschneiden und dabei bis zu ~20% vom Rand kappen. Das Motiv steht
// deshalb anders als bei icon-512.png NICHT randabschneidend, sondern
// zentriert bei ~66% Groesse (dem ueblichen "Safe Zone"-Richtwert), damit
// es bei jeder Maskenform vollstaendig sichtbar bleibt.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F3B36",
        }}
      >
        <svg viewBox="0 0 100 100" width="340" height="340" xmlns="http://www.w3.org/2000/svg">
          <circle cx="66" cy="62" r="9" fill="#C6F24E" />
          <path d="M38 62V46c0-5 3-8 8-10l10-3h30c3 0 5 2 5 5v24Z" fill="#F2F0E8" />
          <path d="M38 59h-9" stroke="#F2F0E8" strokeWidth="6" strokeLinecap="round" />
          <rect x="10" y="20" width="20" height="51" rx="8" fill="#C6F24E" />
          <path d="M22 40 14 56h5l-2 12 10-18h-5Z" fill="#0F3B36" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
