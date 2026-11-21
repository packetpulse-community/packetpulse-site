import { describe, expect, it } from "vitest";
import { needsOnboarding, onboardingUrlFor } from "./onboarding-guard";

describe("needsOnboarding", () => {
  it("routes an incomplete member", () => {
    expect(needsOnboarding({ onboardingComplete: false, roles: ["member"] })).toBe(true);
  });
  it("lets a completed member through", () => {
    expect(needsOnboarding({ onboardingComplete: true, roles: ["member"] })).toBe(false);
  });
  it("never routes staff", () => {
    expect(needsOnboarding({ onboardingComplete: false, roles: ["admin"] })).toBe(false);
    expect(needsOnboarding({ onboardingComplete: false, roles: ["member", "super_admin"] })).toBe(false);
  });
});

describe("onboardingUrlFor", () => {
  it("keeps the deep link the member asked for", () => {
    expect(onboardingUrlFor("/forums/abc?page=2")).toBe("/onboarding?next=%2Fforums%2Fabc%3Fpage%3D2");
  });
  it("drops anything that is not a safe same-site path", () => {
    expect(onboardingUrlFor("https://evil.example")).toBe("/onboarding");
    expect(onboardingUrlFor("//evil.example")).toBe("/onboarding");
    expect(onboardingUrlFor(null)).toBe("/onboarding");
  });
  it("does not loop back into onboarding or the sign-in pages", () => {
    expect(onboardingUrlFor("/onboarding")).toBe("/onboarding");
    expect(onboardingUrlFor("/login?next=/forums")).toBe("/onboarding");
  });
});
