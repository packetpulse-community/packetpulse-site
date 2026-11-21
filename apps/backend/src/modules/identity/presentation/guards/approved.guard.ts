import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_APPROVAL_KEY } from "../decorators/skip-approval.decorator";
import { ALLOW_DEACTIVATED_KEY } from "../decorators/allow-deactivated.decorator";
import { SKIP_EMAIL_VERIFICATION_KEY } from "../decorators/skip-email-verification.decorator";
import { SUPER_ADMIN_ROLE } from "../../domain/constants/permissions.constants";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AccessTokenPayload } from "../../application/services/token.service";

// Approval is orthogonal to role — an unapproved user has no access regardless of
// what role they'd eventually get (plan §4). Re-checks the DB rather than trusting
// the JWT's stale snapshot, since approval can change between token refreshes.
// An approved member also needs a verified email before the account is active —
// the verification link is sent by the approval itself (AdminUsersService).
@Injectable()
export class ApprovedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const user: AccessTokenPayload | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;

    // Account state is read from the database on every request, not trusted from the token:
    // an erased account (TASK-046) must stop working at once, whatever roles the token still
    // lists, and a deactivated one (deletion grace period) may only reach the routes that opt in.
    const record = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { isApproved: true, emailVerified: true, deactivatedAt: true, erasedAt: true },
    });
    if (record?.erasedAt) throw new UnauthorizedException();
    if (record?.deactivatedAt) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DEACTIVATED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          message: "Your account is scheduled for deletion. Cancel the deletion to use it again.",
          reason: "ACCOUNT_DEACTIVATED",
        });
      }
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_APPROVAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    if (user.roles.includes(SUPER_ADMIN_ROLE) || user.roles.includes("admin")) return true;

    if (!record?.isApproved) {
      throw new ForbiddenException("Your account is pending admin approval");
    }

    const skipVerification = this.reflector.getAllAndOverride<boolean>(SKIP_EMAIL_VERIFICATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!skipVerification && !record.emailVerified) {
      throw new ForbiddenException("Please verify your email to activate your account");
    }
    return true;
  }
}
