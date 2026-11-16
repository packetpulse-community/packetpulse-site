import type { StoredFile } from "@prisma/client";

const STAFF_ROLES = ["admin", "super_admin"];

// The single place that decides who may open or delete a stored file. Today: the owner, and
// admin/super_admin. Recruiters (after the owner forwards a resume) get added here later.
export function canOpen(user: { sub: string; roles: string[] }, file: Pick<StoredFile, "ownerId">): boolean {
  return file.ownerId === user.sub || user.roles.some((r) => STAFF_ROLES.includes(r));
}
