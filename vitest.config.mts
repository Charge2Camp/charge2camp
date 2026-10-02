import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Nur reine Logik testen (src/lib/**): kein DOM, kein Supabase, kein Netzwerk.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
