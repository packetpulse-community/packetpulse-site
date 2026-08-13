import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
  }

  canActivate(context: ExecutionContext) {
    // Public routes still run the JWT strategy (not skipped entirely) so req.user
    // gets populated when a valid token IS present — e.g. an admin browsing the
    // public resources list needs req.user to see pending/unapproved items too.
    // Only the "must be authenticated" enforcement is skipped for public routes,
    // via handleRequest below. Guards are singleton-scoped, so isPublic is
    // recomputed from `context` here (not stored on `this`) to stay request-safe
    // under concurrent requests.
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (this.isPublic(context)) return (user ?? undefined) as TUser;
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }
}
