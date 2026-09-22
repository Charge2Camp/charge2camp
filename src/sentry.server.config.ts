import * as Sentry from "@sentry/nextjs";

/** Fehler-Monitoring (Node-Runtime: Server Components, Route Handler,
 * Server Actions). Siehe instrumentation-client.ts fuer die Client-Seite
 * und instrumentation.ts fuer die Verdrahtung (register()). */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
