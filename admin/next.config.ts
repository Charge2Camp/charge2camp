import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // OPTIMIERUNG.md, Befund S-2 -- Begruendung und Report-Only-Strategie in
  // lib/security-headers.ts. Das Admin-Backend laedt Dateien per Signed-URL
  // direkt zu Supabase Storage hoch (connect-src ueber supabaseUrl) und
  // braucht keine Browser-APIs wie Geolocation.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          isDev: process.env.NODE_ENV === "development",
          permissionsPolicy: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        }),
      },
    ];
  },
  // admin/ ist eine eigenstaendige App im selben Repo wie die Haupt-App
  // (eigenes package.json/package-lock.json). Ohne dieses explizite Root
  // erkennt Turbopack wegen des Haupt-App-Lockfiles im uebergeordneten
  // Ordner faelschlich den Repo-Root als Workspace-Root und zieht Dateien
  // aus deren src/ mit in den Build (z. B. src/proxy.ts) -- dort werden
  // "@/..."-Importe dann fehlerhaft gegen DIESE tsconfig.json aufgeloest.
  turbopack: {
    root: path.join(__dirname),
  },
};

// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN sind optional (siehe
// .env.example) -- ohne SENTRY_AUTH_TOKEN wird der Source-Map-Upload beim
// Build automatisch uebersprungen (kein Build-Fehler).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
