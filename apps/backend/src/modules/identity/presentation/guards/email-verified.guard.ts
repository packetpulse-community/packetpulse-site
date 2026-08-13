import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SKIP_EMAIL_VERIFICATION_KEY } from "../decorators/skip-email-verification.decorator";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AccessTokenPayload } from "../../application/services/token.service";

// Unverified users can still log in (so they aren't locked out of fixing their
// email) but are blocked from write/content-creation actions until verified
// (plan §4) — mirrors ApprovedGuard's shape.
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
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

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_EMAIL_VERIFICATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const user: AccessTokenPayload | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const record = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { emailVerified: true } });
    if (!record?.emailVerified) {
      throw new ForbiddenException("Please verify your email before performing this action");
    }
    return true;
  }
}
