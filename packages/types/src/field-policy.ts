import { PROFILE_PRIVACY_FIELDS } from "./consent";

// Field-level protection (TASK-012, SEC-02, TEST-034).
//
// A declarative table of the sensitive fields the platform stores and who may read each
// one. The backend helper (apps/backend/src/common/field-policy) strips every field the
// viewer is not allowed to see from any object or list before it is returned, so adding
// protection for a new field is one more entry here, not new code.
//
// A viewer may read a field when ANY of these is true:
//   - one of their roles is in `roles`
//   - one of the relationships they have to the object the field sits on is in `relationships`
// and NONE of their roles or relationships is in `deny`. `deny` wins over everything, so a
// rule such as "date of birth is never shown to companies" (DEC-015) is a single entry.
//
// Relationships are named by the code that knows them. The helper itself derives "self"
// (the object is the viewer's own record); later rules supply their own, for example
// "recruiter-forwarded" or "company" once candidate forwarding exists.

export const SENSITIVITY_CLASSES = [
  "credential", // password hashes, token hashes: never leave the server
  "contact", // email, phone: reach a person directly
  "network", // IP address, user agent: tie a person to a device or place
  "activity", // last login, internal audit details
  "approval", // who approved whom, and when
  "personal", // date of birth and similar (v2 candidate profile)
  "compensation", // CTC, expected salary, notice period (v2 candidate profile)
  "notes", // recruiter notes (v2)
] as const;
export type SensitivityClass = (typeof SENSITIVITY_CLASSES)[number];

export type FieldRelationship = "self" | (string & {});

export interface FieldPolicyEntry {
  /** Property name as it appears in a response object (matched at any nesting depth). */
  field: string;
  sensitivity: SensitivityClass;
  /** Role names that may read the field regardless of relationship. */
  roles: readonly string[];
  /** Relationships to the owning object that may read the field. */
  relationships: readonly FieldRelationship[];
  /** Roles or relationships that may never read it, even if allowed above. */
  deny?: readonly string[];
}

export interface FieldPolicyViewer {
  /** Absent for anonymous callers. */
  userId?: string;
  roles: readonly string[];
  /** Extra relationships that hold for the whole response (e.g. "recruiter-forwarded"). */
  relationships?: readonly FieldRelationship[];
}

const ADMINS = ["admin", "super_admin"] as const;

/** The relationship a viewer has to a profile whose owner opened `field` to signed-in members. */
export const memberVisibleRelationship = (field: string) => `member-visible:${field}`;

export const FIELD_POLICY: readonly FieldPolicyEntry[] = [
  { field: "passwordHash", sensitivity: "credential", roles: [], relationships: [] },
  { field: "tokenHash", sensitivity: "credential", roles: [], relationships: [] },
  { field: "email", sensitivity: "contact", roles: ADMINS, relationships: ["self"] },
  { field: "whatsappNumber", sensitivity: "contact", roles: ADMINS, relationships: ["self"] },
  { field: "ipAddress", sensitivity: "network", roles: ADMINS, relationships: ["self"] },
  { field: "ip", sensitivity: "network", roles: ADMINS, relationships: [] },
  { field: "userAgent", sensitivity: "network", roles: ADMINS, relationships: ["self"] },
  { field: "lastLoginAt", sensitivity: "activity", roles: ADMINS, relationships: [] },
  { field: "approvedById", sensitivity: "approval", roles: ADMINS, relationships: [] },
  { field: "approvedAt", sensitivity: "approval", roles: ADMINS, relationships: ["self"] },
  // Profile fields the member controls (TASK-025, DEC-015, PRD-052). Private unless the owner
  // chose "members": the members endpoint supplies the "member-visible:<field>" relationship for
  // exactly the fields the owner opened up. Staff always read them; nobody else does by default.
  ...PROFILE_PRIVACY_FIELDS.map(
    (field): FieldPolicyEntry => ({
      field,
      sensitivity: "personal",
      roles: ADMINS,
      relationships: ["self", memberVisibleRelationship(field)],
    }),
  ),
];
