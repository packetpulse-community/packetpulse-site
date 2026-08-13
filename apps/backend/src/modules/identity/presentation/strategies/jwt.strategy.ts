import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { AccessTokenPayload } from "../../application/services/token.service";

// Reads the access token from the httpOnly cookie first, falling back to a bearer
// header for non-browser API clients — the old app supported both too (plan §4).
function extractFromCookieOrHeader(req: Request): string | null {
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: AccessTokenPayload) {
    return payload;
  }
}
