import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Das Projekt liegt in einem live synchronisierten OneDrive-Ordner
    // (C:\Users\...\OneDrive\Dokumente\eCamper) -- Turbopacks persistenter
    // Dev-Dateisystem-Cache (.next/cache, seit Next 16 standardmaessig an)
    // geriet dort wiederholt in einen inkonsistenten Zustand (Audit-Befund
    // 2026-09-28: "ReferenceError: EV_AMENITY_CATEGORY is not defined" nach
    // laengst entfernten Referenzen, reproduzierbar nach schnellem
    // Filter-Umschalten) -- vermutlich Dateisperren/verzoegerte Schreibungen
    // durch den OneDrive-Sync-Client waehrend Turbopack in denselben Cache
    // schreibt. In-Memory-Neukompilierung statt persistentem Disk-Cache
    // behebt die Ursache, kostet nur etwas Zeit beim naechsten `npm run dev`
    // nach einem Neustart (kein Wiederverwenden alter Kompilate).
    turbopackFileSystemCacheForDev: false,
  },
};

// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN sind optional (siehe
// .env.example) -- ohne SENTRY_AUTH_TOKEN wird der Source-Map-Upload beim
// Build automatisch uebersprungen (kein Build-Fehler), Sentry.init() selbst
// ist bereits ueber NEXT_PUBLIC_SENTRY_DSN separat deaktivierbar (siehe
// instrumentation-client.ts).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
