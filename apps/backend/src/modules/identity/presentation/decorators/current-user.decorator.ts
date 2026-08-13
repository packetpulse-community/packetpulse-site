import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AccessTokenPayload } from "../../application/services/token.service";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
