// Front-end mirror of how the backend decides access (RolesGuard + ApprovedGuard).
// It exists ONLY so a person never sees a control they cannot use (Document 3 §3);
// the server re-checks every request, so nothing here is a security boundary.

export const SUPER_ADMIN = "super_admin";
export const ADMIN = "admin";

/** The part of the /auth/me response the access rules need. */
export interface AccessSubject {
  roles: readonly string[];
  permissions: readonly string[];
  isApproved: boolean;
  emailVerified: boolean;
}

/**
 * A declarative access rule. `{ permission }` and `{ role }` are leaves; `anyOf`
 * and `allOf` combine them. `"signed-in"` is any signed-in person.
 */
export type AccessRule =
  | "signed-in"
  | { permission: string }
  | { role: string }
  | { anyOf: readonly AccessRule[] }
  | { allOf: readonly AccessRule[] };

export function isSuperAdmin(subject: Pick<AccessSubject, "roles">): boolean {
  return subject.roles.includes(SUPER_ADMIN);
}

/** Admin staff = admin or super_admin (super_admin is "admin plus", Document 3 §2.2). */
export function isAdminStaff(subject: Pick<AccessSubject, "roles">): boolean {
  return subject.roles.includes(ADMIN) || isSuperAdmin(subject);
}

export function hasRole(subject: Pick<AccessSubject, "roles">, role: string): boolean {
  if (subject.roles.includes(role)) return true;
  // super_admin holds every admin page.
  return role === ADMIN && isSuperAdmin(subject);
}

/** super_admin bypasses permission checks on the server (RolesGuard), so it does here. */
export function hasPermission(subject: Pick<AccessSubject, "roles" | "permissions">, permission: string): boolean {
  return isSuperAdmin(subject) || subject.permissions.includes(permission);
}

/**
 * Mirrors ApprovedGuard: admins always pass; everyone else needs an approved account
 * AND a verified email before the server will answer anything beyond the public pages.
 */
export function isActiveAccount(subject: Pick<AccessSubject, "roles" | "isApproved" | "emailVerified">): boolean {
  return isAdminStaff(subject) || (subject.isApproved && subject.emailVerified);
}

export function matchesRule(subject: AccessSubject, rule: AccessRule): boolean {
  if (rule === "signed-in") return true;
  if ("permission" in rule) return hasPermission(subject, rule.permission);
  if ("role" in rule) return hasRole(subject, rule.role);
  if ("anyOf" in rule) return rule.anyOf.some((r) => matchesRule(subject, r));
  return rule.allOf.every((r) => matchesRule(subject, r));
}

const ROLE_LABELS: ReadonlyArray<[string, string]> = [
  [SUPER_ADMIN, "Super admin"],
  [ADMIN, "Administrator"],
  ["moderator", "Moderator"],
  ["instructor", "Instructor"],
  ["mentor", "Mentor"],
  ["recruiter", "Recruiter"],
];

/** The most senior role, as words, for the account block ("Member" when there is none). */
export function primaryRoleLabel(subject: Pick<AccessSubject, "roles">): string {
  return ROLE_LABELS.find(([role]) => subject.roles.includes(role))?.[1] ?? "Member";
}
