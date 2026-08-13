import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_APPROVAL_KEY } from "../decorators/skip-approval.decorator";
import { SUPER_ADMIN_ROLE } from "../../domain/constants/permissions.constants";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AccessTokenPayload } from "../../application/services/token.service";

// Approval is orthogonal to role — an unapproved user has no access regardless of
// what role they'd eventually get (plan §4). Re-checks the DB rather than trusting
// the JWT's stale snapshot, since approval can change between token refreshes.
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

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_APPROVAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const user: AccessTokenPayload | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.roles.includes(SUPER_ADMIN_ROLE) || user.roles.includes("admin")) return true;

    const record = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { isApproved: true } });
    if (!record?.isApproved) {
      throw new ForbiddenException("Your account is pending admin approval");
    }
    return true;
  }
}
