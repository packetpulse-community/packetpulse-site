import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";

export const REALTIME_CHANNEL = "realtime:events";

export interface RealtimeEvent {
  userId: string;
  event: string;
  payload: unknown;
}

// Thin publish-only interface other modules' BullMQ processors depend on — keeps
// them decoupled from the realtime module's gateway internals (plan §5). Backed by
// Redis pub/sub (not an in-process EventEmitter) so this stays correct once the
// backend is scaled to multiple stateless replicas (plan §3) — the replica that
// enqueued the job and the replica holding the user's live socket may differ.
@Injectable()
export class RealtimeEmitterService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async emit(userId: string, event: string, payload: unknown) {
    const message: RealtimeEvent = { userId, event, payload };
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }
}
