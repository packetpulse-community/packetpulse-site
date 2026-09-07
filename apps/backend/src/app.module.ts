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
import { BlogsModule } from "./modules/blogs";
import { ResourcesModule } from "./modules/resources";
import { RecordingsModule } from "./modules/recordings";
import { ForumsModule } from "./modules/forums";
import { QuizzesModule } from "./modules/quizzes";
import { AdminModule } from "./modules/admin";
import { RedisModule } from "./common/redis/redis.module";
import { NotificationsModule } from "./modules/notifications";
import { RealtimeModule } from "./modules/realtime";
import { NetworkToolsModule } from "./modules/network-tools";
import { DashboardModule } from "./modules/dashboard";
import { LogsModule } from "./modules/logs";

// Feature modules land here as they're built (migration plan phases). Global guard
// chain — JwtAuthGuard → RolesGuard → ApprovedGuard, with @Public() opting a route
// out entirely (plan §4) — plus a global ThrottlerGuard so no route is accidentally
// unlimited (plan §4 rate-limit tiers, overridden per-route via @Throttle).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]), // global read-standard default
    PrismaModule,
    RedisModule,
    ObservabilityLoggerModule,
    HealthModule,
    NotificationsModule,
    RealtimeModule,
    IdentityModule,
    UsersModule,
    BlogsModule,
    ResourcesModule,
    RecordingsModule,
    ForumsModule,
    QuizzesModule,
    AdminModule,
    NetworkToolsModule,
    DashboardModule,
    LogsModule,
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
