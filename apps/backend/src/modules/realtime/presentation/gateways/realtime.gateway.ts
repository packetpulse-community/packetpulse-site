import { Inject, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Namespace, Socket } from "socket.io";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../../../common/redis/redis.constants";
import { REALTIME_CHANNEL, RealtimeEvent } from "../../../../common/realtime/realtime-emitter.service";
import { AccessTokenPayload } from "../../../identity";

const PRESENCE_KEY = "realtime:presence";

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Cookie-authenticated (the same httpOnly accessToken cookie used by HTTP requests,
// plan §5), joins user:{userId} rooms. Subscribes to the shared Redis pub/sub
// channel (common/realtime) rather than holding any in-process event bus, so this
// works correctly once the backend runs as multiple stateless replicas (plan §3).
@WebSocketGateway({ namespace: "/ws", cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private subscriber: Redis;

  // Typed as Namespace, not the top-level Server — because this gateway declares a
  // namespace ("/ws"), Nest injects the Namespace instance here. Server.adapter is a
  // different, incompatible thing (a method for configuring the adapter constructor,
  // not an Adapter instance) — using the Server type here is what caused the
  // handleDisconnect crash above.
  @WebSocketServer()
  server!: Namespace;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.subscriber = this.redis.duplicate(); // ioredis: a client in subscribe mode can't run other commands
  }

  afterInit() {
    this.subscriber.subscribe(REALTIME_CHANNEL).catch((err) => this.logger.error("Failed to subscribe", err));
    this.subscriber.on("message", (_channel, message) => {
      try {
        const event: RealtimeEvent = JSON.parse(message);
        this.server.to(`user:${event.userId}`).emit(event.event, event.payload);
      } catch (err) {
        this.logger.error("Failed to process realtime event", err);
      }
    });
  }

  async handleConnection(client: Socket) {
    const token = parseCookie(client.handshake.headers.cookie, "accessToken");
    if (!token) return client.disconnect();

    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);
      await this.redis.sadd(PRESENCE_KEY, payload.sub);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    try {
      // Getting this.server's type wrong here (Server instead of Namespace)
      // previously crashed the *entire process* on every disconnect (reproduced
      // during manual testing) — an uncaught exception in a gateway lifecycle hook
      // isn't scoped to the one connection, it takes down the whole app. Wrapped in
      // try/catch as a second line of defense: no future bug in this handler should
      // ever be able to do that again, it should degrade to a stale presence entry
      // at worst.
      const room = this.server.adapter.rooms?.get(`user:${userId}`);
      if (!room || room.size === 0) {
        await this.redis.srem(PRESENCE_KEY, userId);
      }
    } catch (err) {
      this.logger.error("handleDisconnect failed (presence entry may be stale)", err);
    }
  }

  @SubscribeMessage("ping")
  handlePing() {
    return { event: "pong", data: Date.now() };
  }

  // The duplicated subscriber connection (constructor) is this gateway's own —
  // nothing else closes it, so it leaks (and, in tests, hangs the process) unless
  // closed explicitly here (same class of bug as RedisLifecycleService).
  async onModuleDestroy() {
    try {
      await this.subscriber.quit();
    } catch (err) {
      this.logger.warn("Error closing realtime subscriber connection", err as Error);
    }
  }
}
