import { ImageResponse } from "next/og";

export const contentType = "image/png";

// App-Store-Audit (2026-09-24): manifest.ts hatte bisher nur das SVG-Icon
// (sizes: "any") und das 180x180-Apple-Icon -- Androids Installierbarkeits-
// pruefung und die Play-Store-Verpackung (Bubblewrap/PWABuilder) verlangen
// echte 192x192-/512x512-PNG-Groessen (siehe auch icon-512.png/,
// maskable-icon-512.png/). Gleiches Motiv/Rendering wie apple-icon.tsx
// (next/og ImageResponse statt einer statischen Datei), hier aber als
// eigener Route Handler statt der Icon-Konvention, da Next.js darueber
// keine zusaetzlichen, frei benennbaren Groessen fuer das Web-App-Manifest
// erzeugen kann.
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0F3B36" }}>
        <svg viewBox="0 0 100 100" width="192" height="192" xmlns="http://www.w3.org/2000/svg">
          <circle cx="66" cy="62" r="9" fill="#C6F24E" />
          <path d="M38 62V46c0-5 3-8 8-10l10-3h30c3 0 5 2 5 5v24Z" fill="#F2F0E8" />
          <path d="M38 59h-9" stroke="#F2F0E8" strokeWidth="6" strokeLinecap="round" />
          <rect x="10" y="20" width="20" height="51" rx="8" fill="#C6F24E" />
          <path d="M22 40 14 56h5l-2 12 10-18h-5Z" fill="#0F3B36" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
