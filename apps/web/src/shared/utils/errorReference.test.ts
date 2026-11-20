import { describe, expect, it } from "vitest";
import { errorReference, randomReference } from "./errorReference";

describe("errorReference", () => {
  it("uses the first 8 characters of the digest, upper-cased", () => {
    expect(errorReference("a1b2c3d4e5f6")).toBe("A1B2C3D4");
  });
  it("ignores non-alphanumeric characters", () => {
    expect(errorReference("ab-cd_ef gh12")).toBe("ABCDEFGH");
  });
  it("falls back when the digest is missing or too short", () => {
    expect(errorReference(undefined, "abc123")).toBe("ABC123");
    expect(errorReference("ab", "zz99")).toBe("ZZ99");
    expect(errorReference(null)).toBe("UNKNOWN");
  });
  it("never leaks anything but a short code", () => {
    expect(errorReference("x".repeat(500))).toHaveLength(8);
  });
});

describe("randomReference", () => {
  it("returns 8 hex characters", () => {
    expect(randomReference()).toMatch(/^[0-9A-F]{8}$/);
  });
});
