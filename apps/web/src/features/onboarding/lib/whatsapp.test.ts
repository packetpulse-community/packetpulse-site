import { describe, expect, it } from "vitest";
import { ageOn, DateOfBirthSchema, normaliseWhatsappNumber, OptionalWhatsappNumberSchema, RegisterSchema } from "@packetpulse/types";

// TEST-001: the shared rules the registration and onboarding forms and the API all use.
describe("normaliseWhatsappNumber (PRD-006)", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["0091 9876543210", "+919876543210"],
    ["+44 7911 123456", "+447911123456"],
    ["+1 (415) 555-2671", "+14155552671"],
  ])("accepts %s as %s", (input, expected) => {
    expect(normaliseWhatsappNumber(input)).toBe(expected);
  });

  it.each(["12345", "5876543210", "+91 1234567890", "+0123456789", "abc", "98765 4321", "+1234567", "+1234567890123456", "98765x43210"])(
    "rejects %s",
    (input) => {
      expect(normaliseWhatsappNumber(input)).toBeNull();
    },
  );

  it("is optional: blank means not given", () => {
    expect(OptionalWhatsappNumberSchema.parse(undefined)).toBeUndefined();
    expect(OptionalWhatsappNumberSchema.parse("  ")).toBeUndefined();
    expect(OptionalWhatsappNumberSchema.safeParse("nope").success).toBe(false);
  });
});

describe("age rules (PRD-004)", () => {
  const today = new Date("2026-11-21T10:00:00Z");
  it("counts whole years by calendar date", () => {
    expect(ageOn("2008-11-21", today)).toBe(18);
    expect(ageOn("2008-11-22", today)).toBe(17);
    expect(ageOn("2000-02-29", today)).toBe(26);
  });
  it("rejects under-18, future, impossible and malformed dates", () => {
    const years = (n: number) => `${new Date().getUTCFullYear() - n}-01-01`;
    expect(DateOfBirthSchema.safeParse(years(30)).success).toBe(true);
    expect(DateOfBirthSchema.safeParse(years(10)).success).toBe(false);
    expect(DateOfBirthSchema.safeParse("2999-01-01").success).toBe(false);
    expect(DateOfBirthSchema.safeParse("2001-02-30").success).toBe(false);
    expect(DateOfBirthSchema.safeParse("01/02/2001").success).toBe(false);
    expect(DateOfBirthSchema.safeParse("1800-01-01").success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  const base = {
    firstName: "A",
    lastName: "B",
    email: "a@example.com",
    password: "Passw0rd!23",
    consents: [
      { purpose: "terms", policyVersion: 1 },
      { purpose: "privacy", policyVersion: 1 },
    ],
  };
  it("needs the 18+ confirmation", () => {
    expect(RegisterSchema.safeParse(base).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...base, ageConfirmed: false }).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...base, ageConfirmed: true }).success).toBe(true);
  });
  it("normalises the optional number", () => {
    const parsed = RegisterSchema.parse({ ...base, ageConfirmed: true, whatsappNumber: "98765 43210" });
    expect(parsed.whatsappNumber).toBe("+919876543210");
  });
});
