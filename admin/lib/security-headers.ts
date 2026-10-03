/** HTTP-Sicherheits-Header fuer alle Antworten (OPTIMIERUNG.md, Befund S-2),
 * eingebunden ueber headers() in next.config.ts. Bewusst ohne Nonces (Next-
 * Doku "Without Nonces"): Nonces erzwingen dynamisches Rendering jeder Seite
 * und einen Umbau von proxy.ts; die App rendert ohnehin dynamisch, aber
 * script-src 'unsafe-inline' bleibt so der einfachere, risikoaermere erste
 * Schritt. Die uebrigen Direktiven (frame-ancestors, object-src, base-uri,
 * form-action, connect-src) schuetzen trotzdem.
 *
 * Die CSP laeuft zunaechst als Report-Only: MapLibre (Worker aus blob:),
 * Supabase-Auth und Sentry laden aus mehreren Ursprungen, ein vergessener
 * Ursprung wuerde sonst die Karte oder den Login lahmlegen. Verstoesse
 * landen bei gesetzter Sentry-DSN als Security-Report in Sentry; sind sie
 * eine Weile leer, enforceCsp: true setzen.
 *
 * KOPIE von src/lib/security-headers.ts (Haupt-App, dort mit Vitest-Test
 * security-headers.test.ts) -- admin/ ist ein eigenes Next-Projekt mit
 * eigenem Turbopack-Root und kann die Datei nicht importieren. Aenderungen
 * an der Logik an beiden Stellen; CI prueft die Gleichheit nicht. */

export interface CspOptions {
  supabaseUrl?: string;
  sentryDsn?: string;
  isDev: boolean;
  /** Weitere Ziele fuer fetch()/XHR aus dem Browser, z. B. Geocoding. */
  connectSrc?: string[];
}

export interface SecurityHeaderOptions extends CspOptions {
  permissionsPolicy: string;
  enforceCsp?: boolean;
}

/** Sentry nimmt CSP-Berichte unter /api/<projekt>/security/ entgegen, der
 * Schluessel ist der oeffentliche Teil der DSN (steht ohnehin im Client-
 * Bundle). */
export function sentryCspReportUri(dsn: string | undefined): string | null {
  if (!dsn) return null;
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const projectId = url.pathname.replace(/^\/+|\/+$/g, "");
  if (!url.username || !projectId) return null;
  return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
}

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(options: CspOptions): string {
  const supabase = origin(options.supabaseUrl);
  const sentry = origin(options.sentryDsn);
  const reportUri = sentryCspReportUri(options.sentryDsn);

  const connectSrc = ["'self'"];
  if (supabase) connectSrc.push(supabase, supabase.replace(/^http/, "ws"));
  if (sentry) connectSrc.push(sentry);
  connectSrc.push(...(options.connectSrc ?? []));

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(options.isDev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "blob:", "data:"]],
    ["font-src", ["'self'"]],
    ["connect-src", connectSrc],
    // MapLibre startet seine Web Worker aus einer blob:-URL.
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  if (!options.isDev) directives.push(["upgrade-insecure-requests", []]);
  if (reportUri) directives.push(["report-uri", [reportUri]]);

  return directives.map(([name, values]) => [name, ...values].join(" ")).join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  const headers = [
    // Gegen Clickjacking; wirkt auch, solange die CSP (frame-ancestors) nur
    // Report-Only ist -- Report-Only ignoriert frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Zwei Jahre, ohne preload (preload ist praktisch nicht rueckgaengig zu machen).
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    {
      key: options.enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(options),
    },
  ];
  if (options.permissionsPolicy) headers.push({ key: "Permissions-Policy", value: options.permissionsPolicy });
  return headers;
}
