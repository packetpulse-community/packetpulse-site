import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./presentation/controllers/auth.controller";
import { AuthService } from "./application/services/auth.service";
import { AuthCookieService } from "./application/services/auth-cookie.service";
import { TokenService } from "./application/services/token.service";
import { MailerService } from "./infrastructure/email/mailer.service";
import { UserRepository } from "./domain/repositories/user.repository";
import { UserPrismaRepository } from "./infrastructure/prisma/user.prisma-repository";
import { JwtStrategy } from "./presentation/strategies/jwt.strategy";
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard";
import { RolesGuard } from "./presentation/guards/roles.guard";
import { ApprovedGuard } from "./presentation/guards/approved.guard";
import { EmailVerifiedGuard } from "./presentation/guards/email-verified.guard";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_ACCESS_EXPIRES_IN") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    TokenService,
    MailerService,
    { provide: UserRepository, useClass: UserPrismaRepository },
    JwtStrategy,
    // Exported so app.module can wire these as the global APP_GUARD chain —
    // identity is the only module allowed to own guards/decorators (plan §3/§4).
    JwtAuthGuard,
    RolesGuard,
    ApprovedGuard,
    EmailVerifiedGuard,
  ],
  exports: [UserRepository, AuthCookieService, JwtAuthGuard, RolesGuard, ApprovedGuard, EmailVerifiedGuard],
})
export class IdentityModule {}
