import * as Sentry from "@sentry/nextjs";

/** Fehler-Monitoring (Client-Seite, Admin-App). Ohne
 * NEXT_PUBLIC_SENTRY_DSN (lokale Entwicklung ohne Sentry-Account) ist das
 * SDK bewusst ein No-Op. Eigenes Sentry-Projekt empfohlen (siehe
 * .env.example) -- Fehler aus Haupt-App und Admin-Backend sollen nicht in
 * einem Projekt vermischt werden. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Fuer Sentry-Performance-Tracking von App-Router-Navigationen (siehe
// Next.js-Doku instrumentation-client.md, "Router navigation tracking").
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
