import type { StoredFile } from "@prisma/client";

const STAFF_ROLES = ["admin", "super_admin"];

// The single place that decides who may open or delete a stored file. Today: the owner, and
// admin/super_admin (resumes: only with the owner's sharing consent). Recruiters (after the owner
// forwards a resume) get added here later.
export interface AccessContext {
  /** The owner's latest resume_sharing decision is "granted". */
  resumeSharingGranted?: boolean;
  /** The resume finished scanning and parsing (ready or failed), so it is not awaiting a content check. */
  resumeSettled?: boolean;
}

export function canOpen(user: { sub: string; roles: string[] }, file: Pick<StoredFile, "ownerId" | "kind">, ctx: AccessContext = {}): boolean {
  if (file.ownerId === user.sub && file.kind !== "data_export") return true;
  // A data export (TASK-046) holds everything about one member: staff never open it.
  if (file.kind === "data_export") return file.ownerId === user.sub;
  const staff = user.roles.some((r) => STAFF_ROLES.includes(r));
  // A resume (TASK-024) is private to its owner. Staff may open it only while the owner's
  // resume_sharing consent stands and the file has passed the content check.
  if (file.kind === "resume") return staff && ctx.resumeSharingGranted === true && ctx.resumeSettled === true;
  return staff;
}
