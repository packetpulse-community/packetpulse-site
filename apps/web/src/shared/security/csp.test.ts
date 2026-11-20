import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, parseCspMode } from "./csp";

const SUPABASE = "https://abc.supabase.co/";
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("parseCspMode", () => {
  it("defaults to report-only for unset or unknown values", () => {
    for (const v of [undefined, "", "report-only", "off", "true"]) expect(parseCspMode(v)).toBe("report-only");
  });
  it("accepts enforce, case and whitespace tolerant", () => {
    expect(parseCspMode(" Enforce ")).toBe("enforce");
  });
});

describe("cspHeaderName", () => {
  it("uses the report-only header until enforced", () => {
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
  });
});

describe("buildCsp", () => {
  for (const mode of ["report-only", "enforce"] as const) {
    it(`${mode}: has the core directives and the allowed origins`, () => {
      const csp = buildCsp({ mode, production: true, supabaseUrl: SUPABASE });
      for (const d of ["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"]) {
        expect(csp).toContain(d);
      }
      expect(directive(csp, "script-src")).toContain("https://challenges.cloudflare.com");
      expect(directive(csp, "frame-src")).toContain("https://challenges.cloudflare.com");
      expect(directive(csp, "frame-src")).toContain("https://abc.supabase.co");
      expect(directive(csp, "connect-src")).toContain("wss://abc.supabase.co");
    });

    it(`${mode}: never contains unsafe-eval in production`, () => {
      expect(buildCsp({ mode, production: true, supabaseUrl: SUPABASE })).not.toContain("unsafe-eval");
      expect(buildCsp({ mode, production: true, nonce: "n" })).not.toContain("unsafe-eval");
    });
  }

  it("adds upgrade-insecure-requests only when enforcing in production", () => {
    expect(buildCsp({ mode: "enforce", production: true })).toContain("upgrade-insecure-requests");
    expect(buildCsp({ mode: "report-only", production: true })).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ mode: "enforce", production: false })).not.toContain("upgrade-insecure-requests");
  });

  it("allows unsafe-eval and local websockets only outside production", () => {
    const dev = buildCsp({ mode: "report-only", production: false });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("http://localhost:*");
    expect(directive(buildCsp({ mode: "report-only", production: true }), "connect-src")).not.toContain("localhost");
  });

  it("uses a nonce with strict-dynamic instead of unsafe-inline when given one", () => {
    const script = directive(buildCsp({ mode: "enforce", production: true, nonce: "abc" }), "script-src");
    expect(script).toContain("'nonce-abc'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(directive(buildCsp({ mode: "enforce", production: true }), "script-src")).toContain("'unsafe-inline'");
  });

  it("ignores a malformed Supabase URL", () => {
    expect(buildCsp({ mode: "enforce", production: true, supabaseUrl: "not a url" })).not.toContain("not a url");
  });
});
