// Public API barrel — the ONLY way other modules import from identity (plan §3).
export { IdentityModule } from "./identity.module";
export { UserRepository } from "./domain/repositories/user.repository";
export { CredentialProvider } from "./domain/providers/credential-provider";
export { toPublicUser, userWithRolesInclude, type PublicUser, type UserWithRoles } from "./domain/entities/user.entity";
export { PERMISSIONS, SUPER_ADMIN_ROLE, type PermissionKey } from "./domain/constants/permissions.constants";
export { Public } from "./presentation/decorators/public.decorator";
export { CurrentUser } from "./presentation/decorators/current-user.decorator";
export { RequirePermission } from "./presentation/decorators/require-permission.decorator";
export { SkipApproval } from "./presentation/decorators/skip-approval.decorator";
export { SkipEmailVerification } from "./presentation/decorators/skip-email-verification.decorator";
export type { AccessTokenPayload } from "./application/services/token.service";
