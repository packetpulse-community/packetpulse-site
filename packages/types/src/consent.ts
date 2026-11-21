import { z } from "zod";

// Consent records and profile privacy (TASK-025, PRD-010, PRD-045, PRD-052, DB-004, API-008,
// TEST-014). Consent is an append-only history: every grant and every withdrawal is a new row
// that names the policy version the member saw. The policy texts themselves are versioned rows
// a super admin publishes; this file holds the fixed facts about each purpose.

export const CONSENT_PURPOSES = ["terms", "privacy", "resume_sharing", "recruitment_sharing"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export const ConsentPurposeSchema = z.enum(CONSENT_PURPOSES);

export interface ConsentPurposeMeta {
  purpose: ConsentPurpose;
  label: string;
  /** What the member is agreeing to, in plain language. */
  description: string;
  /** Needed to hold an account: asked at registration and again when the policy version changes. */
  required: boolean;
  /**
   * Can be withdrawn from the consent centre. Terms and the privacy notice cannot: withdrawing
   * them means closing the account, which is the existing delete-account action.
   */
  withdrawable: boolean;
  /** The page that carries the full text, when there is one. */
  documentPath: string | null;
}

export const CONSENT_PURPOSE_META: Record<ConsentPurpose, ConsentPurposeMeta> = {
  terms: {
    purpose: "terms",
    label: "Terms of Service",
    description: "The rules for using PacketPulse.",
    required: true,
    withdrawable: false,
    documentPath: "/terms",
  },
  privacy: {
    purpose: "privacy",
    label: "Privacy Policy",
    description: "What PacketPulse stores about you, why, and who can see it.",
    required: true,
    withdrawable: false,
    documentPath: "/privacy",
  },
  resume_sharing: {
    purpose: "resume_sharing",
    label: "Share my resume with PacketPulse reviewers",
    description: "Needed before you can upload a resume. Lets the PacketPulse screening team open the resume you upload; nobody else can. You can withdraw it at any time: you keep your resume, and the team can no longer open it.",
    required: false,
    withdrawable: true,
    documentPath: null,
  },
  recruitment_sharing: {
    purpose: "recruitment_sharing",
    label: "Share my profile with hiring companies",
    description: "Lets PacketPulse forward your profile to a company after a person on the team confirms it. Not used yet: your choice is recorded so it is honoured when recruitment launches.",
    required: false,
    withdrawable: true,
    documentPath: null,
  },
};

export const REQUIRED_CONSENT_PURPOSES = CONSENT_PURPOSES.filter((p) => CONSENT_PURPOSE_META[p].required);

export const CONSENT_ACTIONS = ["granted", "withdrawn"] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

/** Where in the product the choice was made. */
export const CONSENT_SOURCES = ["registration", "consent_centre", "recapture"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

// One accepted policy, as sent at registration: the version is what the page showed, so what was
// accepted can never differ from what the member read.
export const ConsentAcceptanceSchema = z.object({
  purpose: ConsentPurposeSchema,
  policyVersion: z.number().int().min(1),
});
export type ConsentAcceptance = z.infer<typeof ConsentAcceptanceSchema>;

export const RegistrationConsentsSchema = z
  .array(ConsentAcceptanceSchema)
  .max(CONSENT_PURPOSES.length)
  .refine((list) => REQUIRED_CONSENT_PURPOSES.every((p) => list.some((c) => c.purpose === p)), {
    message: "Accept the Terms of Service and the Privacy Policy to create an account",
  })
  .refine((list) => new Set(list.map((c) => c.purpose)).size === list.length, { message: "Each consent can be given once" });

// A change from the consent centre or the re-consent prompt: grant or withdraw, against the
// version the member was looking at.
export const ConsentChangeSchema = z.object({
  purpose: ConsentPurposeSchema,
  action: z.enum(CONSENT_ACTIONS),
  policyVersion: z.number().int().min(1),
});
export const UpdateConsentSchema = z.object({
  changes: z.array(ConsentChangeSchema).min(1).max(CONSENT_PURPOSES.length),
  /** "recapture" when answering the prompt after a policy changed. */
  source: z.enum(["consent_centre", "recapture"]).default("consent_centre"),
});
export type UpdateConsentInput = z.input<typeof UpdateConsentSchema>;

export interface ConsentPolicyView {
  purpose: ConsentPurpose;
  version: number;
  title: string;
  summary: string;
  documentPath: string | null;
  effectiveAt: string;
  label: string;
  required: boolean;
  withdrawable: boolean;
}

export type ConsentStatus = "granted" | "withdrawn" | "not_given";

export interface MyConsentItem {
  purpose: ConsentPurpose;
  label: string;
  description: string;
  required: boolean;
  withdrawable: boolean;
  policy: ConsentPolicyView;
  status: ConsentStatus;
  /** The policy version the member last accepted (or withdrew against); null when never asked. */
  acceptedVersion: number | null;
  changedAt: string | null;
  /** A newer policy version exists than the one the member accepted. */
  outdated: boolean;
  /** Required and not currently granted at the latest version: the member must re-accept. */
  needsAction: boolean;
}

export interface ConsentHistoryEntry {
  id: string;
  purpose: ConsentPurpose;
  label: string;
  action: ConsentAction;
  policyVersion: number;
  source: ConsentSource;
  createdAt: string;
}

export interface MyConsentView {
  items: MyConsentItem[];
  history: ConsentHistoryEntry[];
  needsAction: boolean;
}

// Super admin publishes a new version of a policy (API-042). A new version makes every
// member's required consent outdated, so they are asked again; the reason goes in the audit log.
export const PublishConsentPolicySchema = z.object({
  purpose: ConsentPurposeSchema,
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(10).max(2000),
  reason: z.string().trim().min(10, "Say why the policy changed (at least 10 characters)").max(500),
});
export type PublishConsentPolicyInput = z.infer<typeof PublishConsentPolicySchema>;

export interface AdminConsentPolicyRow extends ConsentPolicyView {
  id: string;
  createdAt: string;
  /** Members whose latest decision on this purpose is "granted" at exactly this version. */
  grantedCount: number;
}

// ---------------------------------------------------------------------------------------------
// Profile visibility (DEC-015, PRD-052, OPEN-19). Private is the default and the only way a
// sensitive field is shown to other members is the member choosing "members". There is no
// public level: no public web profile at launch (SCR-042 is deferred).
// ---------------------------------------------------------------------------------------------

export const PROFILE_VISIBILITY_LEVELS = ["private", "members"] as const;
export type ProfileVisibilityLevel = (typeof PROFILE_VISIBILITY_LEVELS)[number];
export const ProfileVisibilityLevelSchema = z.enum(PROFILE_VISIBILITY_LEVELS);

export const PROFILE_PRIVACY_FIELDS = ["bio", "professionalExperience", "socialLinks", "certifications"] as const;
export type ProfilePrivacyField = (typeof PROFILE_PRIVACY_FIELDS)[number];

export const PROFILE_PRIVACY_FIELD_META: Record<ProfilePrivacyField, { label: string; description: string }> = {
  bio: { label: "About me", description: "The short bio on your profile." },
  professionalExperience: { label: "Experience level", description: "Student, junior, mid-level, senior or lead." },
  socialLinks: { label: "Social links", description: "LinkedIn, GitHub, X and your website." },
  certifications: { label: "Certifications", description: "Certifications you listed yourself." },
};

/** Always private, whatever the setting: shown only to you and PacketPulse staff. */
export const ALWAYS_PRIVATE_PROFILE_FIELDS = [
  { field: "email", label: "Email address" },
  { field: "whatsappNumber", label: "WhatsApp number" },
] as const;

export const UpdateProfilePrivacySchema = z
  .object({
    bio: ProfileVisibilityLevelSchema,
    professionalExperience: ProfileVisibilityLevelSchema,
    socialLinks: ProfileVisibilityLevelSchema,
    certifications: ProfileVisibilityLevelSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Choose at least one setting to change" });
export type UpdateProfilePrivacyInput = z.infer<typeof UpdateProfilePrivacySchema>;

export interface ProfilePrivacyView {
  settings: Record<ProfilePrivacyField, ProfileVisibilityLevel>;
  alwaysPrivate: { field: string; label: string }[];
  updatedAt: string | null;
}

/** What another signed-in member sees. Fields the owner kept private are absent, not null. */
export interface MemberProfileView {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  bio?: string | null;
  professionalExperience?: string | null;
  socialLinks?: { linkedin: string | null; github: string | null; twitter: string | null; website: string | null } | null;
  certifications?: { name: string; issueDate: string | null; expiryDate: string | null; verificationUrl: string | null }[];
}
