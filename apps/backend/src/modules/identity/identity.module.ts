import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./presentation/controllers/auth.controller";
import { AuthService } from "./application/services/auth.service";
import { AuthCookieService } from "./application/services/auth-cookie.service";
import { TokenService } from "./application/services/token.service";
import { NotificationsModule } from "../notifications";
import { UserRepository } from "./domain/repositories/user.repository";
import { UserPrismaRepository } from "./infrastructure/prisma/user.prisma-repository";
import { CredentialProvider } from "./domain/providers/credential-provider";
import { LocalCredentialProvider } from "./infrastructure/local/local-credential.provider";
import { SupabaseCredentialProvider } from "./infrastructure/supabase/supabase-credential.provider";
import { SUPABASE_CLIENT, supabaseClientProvider } from "../../common/supabase/supabase-client.provider";
import { JwtStrategy } from "./presentation/strategies/jwt.strategy";
import { JwtAuthGuard } from "./presentation/guards/jwt-auth.guard";
import { RolesGuard } from "./presentation/guards/roles.guard";
import { ApprovedGuard } from "./presentation/guards/approved.guard";
import { EmailVerifiedGuard } from "./presentation/guards/email-verified.guard";

@Module({
  imports: [
    PassportModule,
    NotificationsModule,
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
    { provide: UserRepository, useClass: UserPrismaRepository },
    supabaseClientProvider,
    {
      provide: CredentialProvider,
      inject: [ConfigService, SUPABASE_CLIENT],
      useFactory: (config: ConfigService, supabase) =>
        config.get<string>("PLATFORM_MODE") === "supabase"
          ? new SupabaseCredentialProvider(supabase)
          : new LocalCredentialProvider(),
    },
    JwtStrategy,
    // Exported so app.module can wire these as the global APP_GUARD chain —
    // identity is the only module allowed to own guards/decorators (plan §3/§4).
    JwtAuthGuard,
    RolesGuard,
    ApprovedGuard,
    EmailVerifiedGuard,
  ],
  exports: [
    UserRepository,
    CredentialProvider,
    AuthCookieService,
    JwtAuthGuard,
    RolesGuard,
    ApprovedGuard,
    EmailVerifiedGuard,
  ],
})
export class IdentityModule {}
