import { describe, expect, it } from "vitest";
import {
  VIEWPORT_MAX_ATTEMPTS,
  VIEWPORT_MAX_ATTEMPTS_NETWORK,
  isTransientViewportStatus,
  viewportFailReasonFor,
  viewportRetryDelayMs,
} from "./viewport-retry";

describe("isTransientViewportStatus", () => {
  it("wiederholt bei Rate-Limit und Serverfehlern", () => {
    for (const status of [429, 500, 502, 503, 504]) expect(isTransientViewportStatus(status)).toBe(true);
  });

  it("wiederholt nicht bei dauerhaften Fehlern", () => {
    for (const status of [200, 400, 401, 403, 404]) expect(isTransientViewportStatus(status)).toBe(false);
  });
});

describe("viewportRetryDelayMs", () => {
  it("steigert die Wartezeit und endet nach der Hoechstzahl", () => {
    expect(viewportRetryDelayMs(1)).toBe(2000);
    expect(viewportRetryDelayMs(2)).toBe(5000);
    expect(viewportRetryDelayMs(VIEWPORT_MAX_ATTEMPTS)).toBeNull();
  });

  it("nutzt bei Netzwerkfehlern nur einen zweiten Versuch", () => {
    expect(viewportRetryDelayMs(1, null, VIEWPORT_MAX_ATTEMPTS_NETWORK)).toBe(2000);
    expect(viewportRetryDelayMs(2, null, VIEWPORT_MAX_ATTEMPTS_NETWORK)).toBeNull();
  });

  it("bevorzugt einen numerischen Retry-After-Header (Sekunden)", () => {
    expect(viewportRetryDelayMs(1, "3")).toBe(3000);
    expect(viewportRetryDelayMs(1, "0")).toBe(0);
  });

  it("begrenzt Retry-After auf 15 Sekunden", () => {
    expect(viewportRetryDelayMs(1, "120")).toBe(15000);
  });

  it("ignoriert unbrauchbare Retry-After-Werte", () => {
    expect(viewportRetryDelayMs(1, "abc")).toBe(2000);
    expect(viewportRetryDelayMs(1, "-5")).toBe(2000);
    expect(viewportRetryDelayMs(2, "")).toBe(5000);
  });
});

describe("viewportFailReasonFor", () => {
  it("ordnet Ursachen zu", () => {
    expect(viewportFailReasonFor(null)).toBe("network");
    expect(viewportFailReasonFor(429)).toBe("rate_limit");
    expect(viewportFailReasonFor(500)).toBe("error");
    expect(viewportFailReasonFor(401)).toBe("error");
  });
});
