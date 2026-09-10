import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { SupabaseClient } from "@supabase/supabase-js";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { SUPABASE_CLIENT } from "../supabase/supabase-client.provider";

export const REALTIME_CHANNEL = "realtime:events";

export interface RealtimeEvent {
  userId: string;
  event: string;
  payload: unknown;
}

// Thin publish-only interface other modules' BullMQ processors depend on — keeps
// them decoupled from the realtime module's gateway internals (plan §5).
//
// PLATFORM_MODE=docker: publishes over Redis pub/sub (not an in-process
// EventEmitter) so this stays correct once the backend is scaled to multiple
// stateless replicas (plan §3) — the replica that enqueued the job and the
// replica holding the user's live socket may differ. RealtimeGateway subscribes
// and fans out to Socket.IO.
//
// PLATFORM_MODE=supabase: broadcasts directly on a per-user Supabase Realtime
// channel instead — the frontend subscribes to that channel with supabase-js
// rather than connecting to this backend's /ws gateway at all (platform-mode plan §3).
@Injectable()
export class RealtimeEmitterService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient | null,
    private readonly config: ConfigService,
  ) {}

  async emit(userId: string, event: string, payload: unknown) {
    if (this.config.get<string>("PLATFORM_MODE") === "supabase" && this.supabase) {
      const channel = this.supabase.channel(`user:${userId}`);
      await channel.send({ type: "broadcast", event, payload });
      await this.supabase.removeChannel(channel);
      return;
    }

    const message: RealtimeEvent = { userId, event, payload };
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }
}
