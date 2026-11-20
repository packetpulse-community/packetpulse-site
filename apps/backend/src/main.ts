import "./observability/tracing"; // must be the first import — see observability/tracing.ts

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";
import { parseTrustProxy } from "./common/config/trust-proxy";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Behind Render's load balancer (and Vercel's /api rewrite proxy) the socket
  // address is the proxy's, not the visitor's — without this, req.ip was the same
  // for everyone, so per-IP rate limits (e.g. 5 logins / 15 min) were shared by the
  // whole site and one person's retries locked every user out. Trusting the proxy
  // chain makes req.ip the original client from X-Forwarded-For. Trade-off: a
  // client calling the backend directly can spoof that header to dodge throttling.
  // TRUST_PROXY narrows this (hop count or proxy addresses); unset keeps `true` so
  // production behaviour does not change until the owner sets it (finding S-11).
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  app.set("trust proxy", trustProxy);
  app.useLogger(app.get(Logger));
  if (process.env.NODE_ENV === "production" && trustProxy === true) {
    app
      .get(Logger)
      .warn(
        "TRUST_PROXY is not set (trusting every proxy) — client IPs, and so per-IP rate limits, can be spoofed with an X-Forwarded-For header. Set TRUST_PROXY to the number of proxies in front of the app; see docs/ops/bot-protection.md.",
      );
  }

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Explicit allowlist only — never "*" combined with credentials (see plan §11).
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix("api");

  // Lets Nest run its shutdown hooks on SIGTERM/SIGINT (Render sends SIGTERM on every deploy):
  // BullMQ workers and queues finish the current job and close instead of being cut off,
  // which keeps a deploy from leaving jobs stalled (TASK-016).
  app.enableShutdownHooks();

  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    app
      .get(Logger)
      .warn(`FRONTEND_URL is not set — email links will use the first CORS origin (${origins[0] ?? "none"})`);
  }

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

bootstrap();
