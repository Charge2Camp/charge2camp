import path from "node:path";
import type { NextConfig } from "next";

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

export default nextConfig;
