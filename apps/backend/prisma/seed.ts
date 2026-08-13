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

const MEMBER_PERMISSIONS = ["blogs:create", "resources:create", "recordings:create", "forums:create", "quizzes:attempt"] as const;

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  member: MEMBER_PERMISSIONS,
  moderator: ["blogs:moderate", "resources:moderate", "recordings:moderate", "forums:moderate"],
  instructor: ["recordings:create", "quizzes:author"],
  // Admins can do everything a member can (found missing during manual UI testing —
  // an admin account couldn't create a forum thread, only moderate one, since only
  // moderate/manage permissions were seeded here) PLUS moderation/management.
  admin: [
    ...MEMBER_PERMISSIONS,
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

  // Default forum categories — no admin UI to create these yet (Phase 4), so a
  // small fixed set is seeded to start.
  const FORUM_CATEGORIES = [
    { name: "General Discussion", slug: "general", position: 0 },
    { name: "CCNA", slug: "ccna", position: 1 },
    { name: "CCNP", slug: "ccnp", position: 2 },
    { name: "Network Automation", slug: "network-automation", position: 3 },
    { name: "Security", slug: "security", position: 4 },
  ];
  for (const category of FORUM_CATEGORIES) {
    await prisma.forumCategory.upsert({ where: { slug: category.slug }, update: {}, create: category });
  }

  console.log("Seeded roles, permissions, and forum categories.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
