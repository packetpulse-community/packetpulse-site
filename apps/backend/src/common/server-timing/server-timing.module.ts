import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { isServerTimingEnabled } from "./server-timing.context";
import { ServerTimingMiddleware } from "./server-timing.middleware";

// Diagnostic only: adds `Server-Timing: db;dur=..;desc="N queries", app;dur=..` to every response
// when SERVER_TIMING is on (default: on outside production). See docs/research/12.
@Module({ providers: [ServerTimingMiddleware] })
export class ServerTimingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    if (isServerTimingEnabled()) consumer.apply(ServerTimingMiddleware).forRoutes("*");
  }
}
