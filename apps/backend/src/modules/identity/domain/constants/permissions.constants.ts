// Mirrors the permission keys seeded in prisma/seed.ts — kept as a typed constant so
// @RequirePermission call sites get autocomplete/typo-checking instead of bare strings.
export const PERMISSIONS = {
  BLOGS_CREATE: "blogs:create",
  BLOGS_PUBLISH: "blogs:publish",
  BLOGS_MODERATE: "blogs:moderate",
  RESOURCES_CREATE: "resources:create",
  RESOURCES_MODERATE: "resources:moderate",
  RECORDINGS_CREATE: "recordings:create",
  RECORDINGS_MODERATE: "recordings:moderate",
  FORUMS_CREATE: "forums:create",
  FORUMS_MODERATE: "forums:moderate",
  QUIZZES_AUTHOR: "quizzes:author",
  QUIZZES_ATTEMPT: "quizzes:attempt",
  USERS_APPROVE: "users:approve",
  USERS_MANAGE_ROLES: "users:manage-roles",
  ADMIN_CLEAN_DATA: "admin:clean-data",
  ADMIN_VIEW_ANALYTICS: "admin:view-analytics",
  ADMIN_MANAGE_SETTINGS: "admin:manage-settings",
  CATEGORIES_MANAGE: "categories:manage",
  SKILLS_MANAGE: "skills:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SUPER_ADMIN_ROLE = "super_admin";

// Roles whose sessions get the short staff limits (SEC-05). Recruiters join this list when
// that role exists; this is the only place that decides who counts as staff.
export const STAFF_ROLES: readonly string[] = [SUPER_ADMIN_ROLE, "admin"];
