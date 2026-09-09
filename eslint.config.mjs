import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // admin/ ist eine eigenstaendige zweite Next.js-App im selben Repo mit
    // eigener eslint.config.mjs -- soll nicht von der Haupt-App-Config
    // mitgelintet werden (eigene tsconfig/"@/"-Aliase).
    "admin/**",
  ]),
]);

export default eslintConfig;
