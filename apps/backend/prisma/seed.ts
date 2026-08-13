import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Default roles + permission catalog. Seeded rather than hardcoded in guard logic
// so adding/adjusting a role never requires a code change (plan §4).
const PERMISSIONS = [
  "blogs:create",
  "blogs:publish",
  "blogs:moderate",
  "resources:create",
  "resources:moderate",
  "recordings:create",
  "recordings:moderate",
  "forums:create",
  "forums:moderate",
  "quizzes:author",
  "quizzes:attempt",
  "users:approve",
  "users:manage-roles",
  "admin:clean-data",
  "admin:view-analytics",
] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  member: ["blogs:create", "resources:create", "recordings:create", "forums:create", "quizzes:attempt"],
  moderator: ["blogs:moderate", "resources:moderate", "recordings:moderate", "forums:moderate"],
  instructor: ["recordings:create", "quizzes:author"],
  admin: [
    "blogs:publish",
    "blogs:moderate",
    "resources:moderate",
    "recordings:moderate",
    "forums:moderate",
    "quizzes:author",
    "users:approve",
    "users:manage-roles",
    "admin:clean-data",
    "admin:view-analytics",
  ],
  // super_admin bypasses permission checks entirely in RolesGuard (plan §4) — no
  // role_permissions rows needed for it.
  super_admin: [],
};

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  for (const [name, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });

    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log("Seeded roles and permissions.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
