import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  sentryCspReportUri,
} from "@/lib/security-headers";

const SUPABASE = "https://abcdefgh.supabase.co";
const DSN = "https://publickey123@o4501234.ingest.de.sentry.io/4507654";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values] as [string, string[]];
      }),
  );
}

describe("sentryCspReportUri", () => {
  it("leitet den Security-Endpunkt aus der DSN ab", () => {
    expect(sentryCspReportUri(DSN)).toBe(
      "https://o4501234.ingest.de.sentry.io/api/4507654/security/?sentry_key=publickey123",
    );
  });

  it("liefert null ohne oder mit ungueltiger DSN", () => {
    expect(sentryCspReportUri(undefined)).toBeNull();
    expect(sentryCspReportUri("")).toBeNull();
    expect(sentryCspReportUri("kein-url")).toBeNull();
    expect(sentryCspReportUri("https://o1.ingest.sentry.io/123")).toBeNull();
  });
});

describe("buildContentSecurityPolicy", () => {
  const csp = directives(
    buildContentSecurityPolicy({ supabaseUrl: SUPABASE, sentryDsn: DSN, isDev: false, connectSrc: ["https://photon.komoot.io"] }),
  );

  it("verbietet Einbetten, Plugins und fremde Formularziele", () => {
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
  });

  it("erlaubt Supabase per HTTPS und WebSocket sowie zusaetzliche Ziele", () => {
    const connect = csp.get("connect-src") ?? [];
    expect(connect).toContain("'self'");
    expect(connect).toContain(SUPABASE);
    expect(connect).toContain("wss://abcdefgh.supabase.co");
    expect(connect).toContain("https://photon.komoot.io");
    expect(connect).toContain("https://o4501234.ingest.de.sentry.io");
  });

  it("erlaubt MapLibre-Worker und Kachelbilder aus blob:", () => {
    expect(csp.get("worker-src")).toContain("blob:");
    expect(csp.get("img-src")).toContain("blob:");
  });

  it("kein unsafe-eval in Produktion, aber im Dev-Modus", () => {
    expect(csp.get("script-src")).not.toContain("'unsafe-eval'");
    const dev = directives(buildContentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: true }));
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
  });

  it("meldet Verstoesse an Sentry, wenn eine DSN gesetzt ist", () => {
    expect(csp.get("report-uri")).toEqual([sentryCspReportUri(DSN)]);
    const noDsn = directives(buildContentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false }));
    expect(noDsn.has("report-uri")).toBe(false);
  });

  it("ignoriert eine fehlende Supabase-URL statt 'undefined' einzutragen", () => {
    const value = buildContentSecurityPolicy({ isDev: false });
    expect(value).not.toContain("undefined");
    expect(value).not.toContain("wss://");
  });
});

describe("buildSecurityHeaders", () => {
  const headers = new Map(
    buildSecurityHeaders({ supabaseUrl: SUPABASE, isDev: false, permissionsPolicy: "geolocation=(self)" }).map(
      (h) => [h.key, h.value],
    ),
  );

  it("setzt die Basis-Header", () => {
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Strict-Transport-Security")).toMatch(/^max-age=\d+; includeSubDomains$/);
    expect(headers.get("Permissions-Policy")).toBe("geolocation=(self)");
  });

  it("liefert die CSP zunaechst nur als Report-Only", () => {
    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(headers.has("Content-Security-Policy")).toBe(false);
  });

  it("kann die CSP erzwingen", () => {
    const enforced = new Map(
      buildSecurityHeaders({ supabaseUrl: SUPABASE, isDev: false, permissionsPolicy: "", enforceCsp: true }).map(
        (h) => [h.key, h.value],
      ),
    );
    expect(enforced.has("Content-Security-Policy")).toBe(true);
    expect(enforced.has("Content-Security-Policy-Report-Only")).toBe(false);
  });
});
