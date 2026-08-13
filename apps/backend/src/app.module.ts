import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./common/config/env.schema";
import { PrismaModule } from "./prisma/prisma.module";
import { ObservabilityLoggerModule } from "./observability/logging/logger.module";
import { HealthModule } from "./observability/health/health.module";

// Feature modules (identity, users, blogs, ...) are added here as they're built —
// see migration plan phases. Kept empty in Phase 0 so the app boots cleanly first.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]), // global read-standard default (plan §4); routes override via @Throttle
    PrismaModule,
    ObservabilityLoggerModule,
    HealthModule,
  ],
})
export class AppModule {}
