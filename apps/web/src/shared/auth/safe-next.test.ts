import { describe, expect, it } from "vitest";
import { loginUrlFor, safeNext, sanitizeNextPath } from "./safe-next";

describe("sanitizeNextPath", () => {
  it.each([
    "/forums",
    "/forums/3f2b8c1e-9d4a-4e6b-8a1f-0c7d5e2b9a41",
    "/resources?category=ccna&page=2",
    "/quizzes/new",
    "/admin/users?status=pending#top",
    "/",
  ])("accepts the same-site path %s", (path) => {
    expect(sanitizeNextPath(path)).toBe(path);
  });

  it.each([
    ["absolute URL", "https://evil.example/phish"],
    ["http URL", "http://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with path", "//evil.example/forums"],
    ["backslash trick", "/\\evil.example"],
    ["tab inside the slashes", "/\t/evil.example"],
    ["newline", "/forums\n//evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>1</script>"],
    ["no leading slash", "forums"],
    ["relative dots", "../forums"],
    ["empty", ""],
    ["only spaces", "   "],
    ["control char", "/foo\u0000bar"],
  ])("rejects %s", (_name, value) => {
    expect(sanitizeNextPath(value)).toBeNull();
  });

  it("rejects null, undefined and absurdly long values", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath(`/${"a".repeat(3000)}`)).toBeNull();
  });

  it("refuses to bounce back to an auth page (would loop)", () => {
    for (const p of ["/login", "/login?next=/forums", "/register", "/refresh?next=/x", "/forgot-password", "/verify-email/abc"]) {
      expect(sanitizeNextPath(p)).toBeNull();
    }
  });

  it("does not treat lookalike paths as auth pages", () => {
    expect(sanitizeNextPath("/login-help")).toBe("/login-help");
  });
});

describe("safeNext", () => {
  it("falls back to the dashboard", () => {
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("/forums")).toBe("/forums");
    expect(safeNext("//x", "/home")).toBe("/home");
  });
});

describe("loginUrlFor", () => {
  it("encodes the requested page", () => {
    expect(loginUrlFor("/forums")).toBe("/login?next=%2Fforums");
    expect(loginUrlFor("/resources?page=2&category=ccna")).toBe("/login?next=%2Fresources%3Fpage%3D2%26category%3Dccna");
  });
  it("is a plain /login when the path is missing or unsafe", () => {
    expect(loginUrlFor(null)).toBe("/login");
    expect(loginUrlFor("//evil.example")).toBe("/login");
    expect(loginUrlFor("/login")).toBe("/login");
  });
});
