import { Prisma } from "@prisma/client";

// Prisma payload type aliases — no separate ORM-less domain model (plan §3).
export const userWithRolesInclude = Prisma.validator<Prisma.UserInclude>()({
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
});

export type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRolesInclude }>;

// The subset of user fields safe to ever send to a client — never includes passwordHash.
export function toPublicUser(user: UserWithRoles) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isApproved: user.isApproved,
    emailVerified: user.emailVerified,
    roles: user.roles.map((r) => r.role.name),
    permissions: [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))],
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;
