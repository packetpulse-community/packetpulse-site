import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

// A raw ioredis client returned from a useFactory has no lifecycle hooks of its own
// — Nest's app.close() won't call anything on it, so the connection (and, in tests,
// the whole process) hangs open indefinitely. This provider exists solely to close
// it on module destroy (found via the e2e suite never exiting after tests passed).
@Injectable()
export class RedisLifecycleService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLifecycleService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch (err) {
      this.logger.warn("Error closing Redis connection", err as Error);
    }
  }
}
