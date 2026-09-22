import * as Sentry from "@sentry/nextjs";

/** Next.js ruft register() einmal beim Serverstart auf (Node- ODER
 * Edge-Runtime, siehe NEXT_RUNTIME) -- laedt je nach Runtime die passende
 * Sentry-Init-Datei. onRequestError faengt Fehler aus Server Components,
 * Route Handlern, Server Actions UND proxy.ts ab (siehe Next.js-Doku
 * instrumentation.md, context.routeType). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
