import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
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
