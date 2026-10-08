import "./observability/tracing"; // must be the first import — see observability/tracing.ts

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Behind Render's load balancer (and Vercel's /api rewrite proxy) the socket
  // address is the proxy's, not the visitor's — without this, req.ip was the same
  // for everyone, so per-IP rate limits (e.g. 5 logins / 15 min) were shared by the
  // whole site and one person's retries locked every user out. Trusting the proxy
  // chain makes req.ip the original client from X-Forwarded-For. Trade-off: a
  // client calling the backend directly can spoof that header to dodge throttling.
  app.set("trust proxy", true);
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // Explicit allowlist only — never "*" combined with credentials (see plan §11).
  const origins = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix("api");

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

bootstrap();
