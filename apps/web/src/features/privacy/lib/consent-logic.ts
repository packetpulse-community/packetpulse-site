import {
  CONSENT_PURPOSE_META,
  REQUIRED_CONSENT_PURPOSES,
  type ConsentAcceptance,
  type ConsentHistoryEntry,
  type ConsentPolicyView,
  type ConsentPurpose,
  type MyConsentItem,
} from "@packetpulse/types";

// Pure helpers for the consent step and the consent centre (TASK-025), kept out of the components
// so they can be unit tested.

export type RegistrationTicks = Partial<Record<ConsentPurpose, boolean>>;

/** Required policies the member has not ticked yet, in the order they are shown. */
export function missingRequired(policies: readonly ConsentPolicyView[], ticks: RegistrationTicks): ConsentPurpose[] {
  return REQUIRED_CONSENT_PURPOSES.filter((p) => policies.some((x) => x.purpose === p) && !ticks[p]);
}

/** The accepted versions to send: exactly the ticked policies, at the version that was on screen. */
export function buildRegistrationConsents(policies: readonly ConsentPolicyView[], ticks: RegistrationTicks): ConsentAcceptance[] {
  return policies.filter((p) => ticks[p.purpose]).map((p) => ({ purpose: p.purpose, policyVersion: p.version }));
}

export function missingRequiredMessage(missing: readonly ConsentPurpose[]): string {
  if (missing.length === 0) return "";
  const names = missing.map((p) => CONSENT_PURPOSE_META[p].label);
  return `Accept the ${names.join(" and the ")} to create an account`;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export function formatConsentTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

export function statusText(item: Pick<MyConsentItem, "status" | "outdated" | "acceptedVersion" | "changedAt">): string {
  const when = formatConsentTime(item.changedAt);
  if (item.status === "not_given") return "Not given yet";
  if (item.status === "withdrawn") return when ? `Withdrawn on ${when}` : "Withdrawn";
  const base = when ? `Accepted on ${when}` : "Accepted";
  return item.outdated ? `${base} (version ${item.acceptedVersion}). A newer version needs your review.` : `${base} (version ${item.acceptedVersion})`;
}

export function historyText(entry: Pick<ConsentHistoryEntry, "action" | "policyVersion" | "source">): string {
  const verb = entry.action === "granted" ? "Accepted" : "Withdrawn";
  const where = { registration: "at sign-up", consent_centre: "in the consent centre", recapture: "when the policy changed" }[entry.source];
  return `${verb} version ${entry.policyVersion} ${where}`;
}
