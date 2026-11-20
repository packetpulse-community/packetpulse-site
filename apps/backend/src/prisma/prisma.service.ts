import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { isServerTimingEnabled, serverTimingContext } from "../common/server-timing/server-timing.context";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Feeds the Server-Timing header: one count and duration per Prisma operation, measured in the
    // caller's async context (Prisma's own query events fire outside it, so they cannot be tied to
    // a request). Only numbers are kept; the model, arguments and SQL are never read.
    if (isServerTimingEnabled()) {
      this.$use(async (params, next) => {
        const started = process.hrtime.bigint();
        try {
          return await next(params);
        } finally {
          serverTimingContext.recordQuery(Number(process.hrtime.bigint() - started) / 1e6);
        }
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
