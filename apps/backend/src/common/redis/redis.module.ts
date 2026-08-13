import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import { RealtimeEmitterService } from "../realtime/realtime-emitter.service";
import { RedisLifecycleService } from "./redis-lifecycle.service";

// One Redis instance, multiple concerns — backs BullMQ, realtime presence, and (once
// wired) the throttler storage adapter and cache layer (plan §5/§3 common/redis).
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("REDIS_URL") },
      }),
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.get<string>("REDIS_URL")!, { maxRetriesPerRequest: null }),
    },
    RealtimeEmitterService,
    RedisLifecycleService,
  ],
  exports: [BullModule, REDIS_CLIENT, RealtimeEmitterService],
})
export class RedisModule {}
