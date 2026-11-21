import { describe, expect, it } from "vitest";
import type { ConsentPolicyView } from "@packetpulse/types";
import { buildRegistrationConsents, historyText, missingRequired, missingRequiredMessage, statusText } from "./consent-logic";

const policy = (purpose: ConsentPolicyView["purpose"], version: number, required: boolean): ConsentPolicyView => ({
  purpose,
  version,
  title: purpose,
  summary: "s",
  documentPath: null,
  effectiveAt: "2026-11-21T00:00:00.000Z",
  label: purpose,
  required,
  withdrawable: !required,
});
const policies = [policy("terms", 3, true), policy("privacy", 2, true), policy("resume_sharing", 1, false)];

describe("registration consents", () => {
  it("reports each required policy that is not ticked", () => {
    expect(missingRequired(policies, {})).toEqual(["terms", "privacy"]);
    expect(missingRequired(policies, { terms: true })).toEqual(["privacy"]);
    expect(missingRequired(policies, { terms: true, privacy: true })).toEqual([]);
  });

  it("an optional tick never satisfies a required one", () => {
    expect(missingRequired(policies, { resume_sharing: true })).toEqual(["terms", "privacy"]);
  });

  it("sends the version that was on screen for exactly the ticked policies", () => {
    expect(buildRegistrationConsents(policies, { terms: true, privacy: true, resume_sharing: false })).toEqual([
      { purpose: "terms", policyVersion: 3 },
      { purpose: "privacy", policyVersion: 2 },
    ]);
    expect(buildRegistrationConsents(policies, { terms: true, privacy: true, resume_sharing: true })).toHaveLength(3);
  });

  it("words the message for one or both missing", () => {
    expect(missingRequiredMessage([])).toBe("");
    expect(missingRequiredMessage(["terms"])).toBe("Accept the Terms of Service to create an account");
    expect(missingRequiredMessage(["terms", "privacy"])).toBe("Accept the Terms of Service and the Privacy Policy to create an account");
  });
});

describe("consent status text", () => {
  it("says what happened, never colour alone", () => {
    expect(statusText({ status: "not_given", outdated: false, acceptedVersion: null, changedAt: null })).toBe("Not given yet");
    expect(statusText({ status: "withdrawn", outdated: false, acceptedVersion: 1, changedAt: null })).toBe("Withdrawn");
    expect(statusText({ status: "granted", outdated: true, acceptedVersion: 1, changedAt: null })).toMatch(/newer version needs your review/);
  });

  it("describes a history entry with its source", () => {
    expect(historyText({ action: "granted", policyVersion: 2, source: "recapture" })).toBe("Accepted version 2 when the policy changed");
    expect(historyText({ action: "withdrawn", policyVersion: 1, source: "consent_centre" })).toBe("Withdrawn version 1 in the consent centre");
  });
});
