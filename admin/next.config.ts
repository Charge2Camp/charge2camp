import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
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
