import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../../../common/redis/redis.constants";

const PRESENCE_KEY = "realtime:presence";

@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onlineUserIds(): Promise<string[]> {
    return this.redis.smembers(PRESENCE_KEY);
  }

  async onlineCount(): Promise<number> {
    return this.redis.scard(PRESENCE_KEY);
  }
}
