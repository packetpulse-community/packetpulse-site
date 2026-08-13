import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ZodValidationPipe } from "nestjs-zod";
import { validateEnv } from "./common/config/env.schema";
import { PrismaModule } from "./prisma/prisma.module";
import { ObservabilityLoggerModule } from "./observability/logging/logger.module";
import { HealthModule } from "./observability/health/health.module";
import { IdentityModule } from "./modules/identity";
import { JwtAuthGuard } from "./modules/identity/presentation/guards/jwt-auth.guard";
import { RolesGuard } from "./modules/identity/presentation/guards/roles.guard";
import { ApprovedGuard } from "./modules/identity/presentation/guards/approved.guard";
import { UsersModule } from "./modules/users";

// Feature modules land here as they're built (migration plan phases). Global guard
// chain — JwtAuthGuard → RolesGuard → ApprovedGuard, with @Public() opting a route
// out entirely (plan §4) — plus a global ThrottlerGuard so no route is accidentally
// unlimited (plan §4 rate-limit tiers, overridden per-route via @Throttle).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]), // global read-standard default
    PrismaModule,
    ObservabilityLoggerModule,
    HealthModule,
    IdentityModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ApprovedGuard },
  ],
})
export class AppModule {}
