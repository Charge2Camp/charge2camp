import type { SVGProps } from "react";

/** UI-Icons aus dem Design-Paket (docs/design/brand-guide.md Abschnitt 6):
 * 24er-Raster, 2px Strich, Outline, `stroke="currentColor"` -- die Farbe
 * kommt bewusst vom umgebenden Element (Tailwind text-*-Klasse), nicht aus
 * der Datei, damit z. B. der aktive Tab-Zustand rein ueber CSS funktioniert.
 * Als React-Komponenten statt <img src> eingebunden, weil <img> nicht per
 * CSS eingefaerbt werden kann. */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconCamping(props: IconProps) {
  return (
    <svg {...base} aria-label="Campingplatz" role="img" {...props}>
      <path d="M12 4.5 21 19.5H3Z" />
      <path d="M9.2 19.5 12 13l2.8 6.5" />
    </svg>
  );
}

export function IconLaden(props: IconProps) {
  return (
    <svg {...base} aria-label="Laden" role="img" {...props}>
      <path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" />
      <path d="M13 5.5 9.8 10.4h2.6L11.2 14" />
    </svg>
  );
}

export function IconRoute(props: IconProps) {
  return (
    <svg {...base} aria-label="Route" role="img" {...props}>
      <path d="M6 19c0-4.5 6-3.5 6-7s6-2.5 6-7" />
      <circle cx="6" cy="20" r="1.8" />
      <circle cx="18" cy="4" r="1.8" />
    </svg>
  );
}

export function IconProfil(props: IconProps) {
  return (
    <svg {...base} aria-label="Profil" role="img" {...props}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c0-4 3-5.6 7-5.6s7 1.6 7 5.6" />
    </svg>
  );
}

export function IconCommunity(props: IconProps) {
  return (
    <svg {...base} aria-label="Community" role="img" {...props}>
      <circle cx="9.3" cy="9" r="3.1" />
      <path d="M3 19.5c0-3.7 3-5.1 6.3-5.1 1.5 0 2.9.3 4 .9" />
      <circle cx="17.4" cy="7.8" r="2.3" />
      <path d="M15.4 13.6c3.4-.1 5.6 1.3 5.6 4.8" />
    </svg>
  );
}

export function IconAuto(props: IconProps) {
  return (
    <svg {...base} aria-label="Auto" role="img" {...props}>
      <path d="M3.5 15.3v-2.6c0-.5.3-.9.7-1.1l2.3-1.1c.2-.1.4-.2.7-.2h6.8c.4 0 .8.2 1.1.4l2.6 2.3c.2.2.4.5.4.8v1.5" />
      <path d="M3.5 15.3h1.9M14.9 15.3h5.6" />
      <circle cx="8" cy="15.4" r="2.1" />
      <circle cx="16" cy="15.4" r="2.1" />
    </svg>
  );
}

export function IconAnhaenger(props: IconProps) {
  return (
    <svg {...base} aria-label="Anhänger" role="img" {...props}>
      <path d="M4.5 15.5v-6c0-1.1.8-2 1.9-2.2L18 5.6c1.3-.2 2 .6 2 1.8v8.1Z" />
      <circle cx="13" cy="15.5" r="2.4" />
      <path d="M4.5 12.5H1.8" />
    </svg>
  );
}
