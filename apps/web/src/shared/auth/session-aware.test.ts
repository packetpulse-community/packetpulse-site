import { describe, expect, it } from "vitest";
import { resolveSessionAction, shouldShowSignedInBanner } from "./session-aware";

const join = {
  signedOut: { href: "/register", label: "Join the Community" },
  signedIn: { href: "/dashboard", label: "Go to dashboard" },
};

describe("resolveSessionAction", () => {
  it("is a placeholder while the hint is unknown (no label in the prerendered HTML)", () => {
    expect(resolveSessionAction("unknown", join)).toEqual({ kind: "placeholder" });
  });
  it("keeps the signed-out action for signed-out visitors", () => {
    expect(resolveSessionAction("signed-out", join)).toEqual({ kind: "link", href: "/register", label: "Join the Community" });
  });
  it("switches to the signed-in action", () => {
    expect(resolveSessionAction("signed-in", join)).toEqual({ kind: "link", href: "/dashboard", label: "Go to dashboard" });
  });
  it("hides a call to action that has no signed-in form, but only when signed in", () => {
    const only = { signedOut: join.signedOut, signedIn: null };
    expect(resolveSessionAction("signed-in", only)).toEqual({ kind: "hidden" });
    expect(resolveSessionAction("signed-out", only).kind).toBe("link");
    expect(resolveSessionAction("unknown", only).kind).toBe("placeholder");
  });
});

describe("shouldShowSignedInBanner", () => {
  it("shows only for a signed-in hint on the three sign-in pages", () => {
    for (const p of ["/login", "/register", "/forgot-password"]) {
      expect(shouldShowSignedInBanner("signed-in", p)).toBe(true);
      expect(shouldShowSignedInBanner("signed-out", p)).toBe(false);
      expect(shouldShowSignedInBanner("unknown", p)).toBe(false);
    }
    expect(shouldShowSignedInBanner("signed-in", "/verify-email")).toBe(false);
  });
});
