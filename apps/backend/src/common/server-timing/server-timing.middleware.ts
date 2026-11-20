import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { formatServerTiming, serverTimingContext, type ServerTimingStore } from "./server-timing.context";

// Starts the per-request timer before guards run (so guard queries are counted) and adds the
// header just before the response head is written, when the totals are final.
@Injectable()
export class ServerTimingMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction) {
    const started = process.hrtime.bigint();
    const store: ServerTimingStore = { dbMs: 0, queries: 0 };

    const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => Response;
    res.writeHead = ((...args: unknown[]) => {
      if (!res.headersSent && !res.getHeader("Server-Timing")) {
        const totalMs = Number(process.hrtime.bigint() - started) / 1e6;
        res.setHeader("Server-Timing", formatServerTiming(store, totalMs));
      }
      return writeHead(...args);
    }) as typeof res.writeHead;

    serverTimingContext.run(store, next);
  }
}
