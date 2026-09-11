import { HomeActions } from "@/components/home/home-actions";

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

      <HomeActions />

      <p className="pt-8 text-xs text-black/40 dark:text-white/40">
        MVP / Testversion &middot; Kartendaten und Ladepunkte teilweise als Demo-Daten gekennzeichnet.
      </p>
    </div>
  );
}
