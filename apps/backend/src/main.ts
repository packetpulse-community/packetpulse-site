import "./observability/tracing"; // must be the first import — see observability/tracing.ts

import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
