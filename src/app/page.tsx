import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Camping mit Elektroauto?
      </h1>
      <p className="text-lg text-black/70 dark:text-white/70">
        Finde Campingplätze und plane deine Route mit anhängertauglichen
        Ladestopps – für dein Auto <em>und</em> deinen Wohnwagen.
      </p>

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          href="/campingplaetze"
          className="rounded-md bg-action px-5 py-3 font-medium text-base hover:bg-action-hover"
        >
          Campingplatz finden
        </Link>
        <Link
          href="/routenplaner"
          className="rounded-md border border-black/10 px-5 py-3 font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Route planen
        </Link>
      </div>

      <p className="pt-8 text-xs text-black/40 dark:text-white/40">
        MVP / Testversion &middot; Kartendaten und Ladepunkte teilweise als Demo-Daten gekennzeichnet.
      </p>
    </div>
  );
}
