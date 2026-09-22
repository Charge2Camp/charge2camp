import * as Sentry from "@sentry/nextjs";

/** Fehler-Monitoring (Edge-Runtime: proxy.ts). Siehe
 * instrumentation-client.ts fuer die Client-Seite, sentry.server.config.ts
 * fuer die Node-Runtime und instrumentation.ts fuer die Verdrahtung. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
