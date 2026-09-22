import * as Sentry from "@sentry/nextjs";

/** Fehler-Monitoring (Client-Seite). Ohne NEXT_PUBLIC_SENTRY_DSN (lokale
 * Entwicklung ohne Sentry-Account) ist das SDK bewusst ein No-Op -- kein
 * Netzwerk-Traffic, keine Fehler durch fehlende Konfiguration. Siehe
 * sentry.server.config.ts / sentry.edge.config.ts fuer die Server-Seite und
 * instrumentation.ts fuer die Verdrahtung. DSN ist kein Secret (siehe
 * .env.example), tracesSampleRate niedrig gehalten (Kostenoptimierung,
 * Projektprinzip 4 -- reicht fuer Fehlererkennung, kein volles APM noetig). */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Fuer Sentry-Performance-Tracking von App-Router-Navigationen (siehe
// Next.js-Doku instrumentation-client.md, "Router navigation tracking").
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
