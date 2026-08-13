import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";

// Redacts cookie/authorization headers and password/token/otp body fields from every
// log line — the old backend logged raw cookies/tokens via console.log (see migration plan §11).
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: [
            "req.headers.cookie",
            "req.headers.authorization",
            "req.body.password",
            "req.body.token",
            "req.body.otp",
          ],
          censor: "[REDACTED]",
        },
        level: process.env.LOG_LEVEL ?? "info",
        transport:
          process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
  ],
})
export class ObservabilityLoggerModule {}
