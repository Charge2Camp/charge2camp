"use client";

import { logPhotoButtonClick } from "@/app/ladepunkte/[id]/actions";
import type { GoogleMapsPhotoLink } from "@/lib/google-maps-link";

/** Sekundärer Button neben "Route hierher planen" (Auftrag "Bilder
 * Rückbau und Button") -- rein ausgehender Link zu Google Maps, keine
 * Google-Inhalte in der App. Öffnet in einem neuen Tab/der Maps-App statt
 * im selben Fenster, damit die App-Navigation erhalten bleibt. */
export function PhotoLinkButton({ link, externalKey }: { link: GoogleMapsPhotoLink; externalKey: string }) {
  return (
    <div className="flex flex-col gap-1">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void logPhotoButtonClick(externalKey, link.tier);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      >
        {link.label}
        <span aria-hidden="true">↗</span>
      </a>
      {link.hint && <p className="text-xs text-text-muted">{link.hint}</p>}
    </div>
  );
}
