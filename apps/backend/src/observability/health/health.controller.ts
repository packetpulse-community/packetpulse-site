import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { PrismaService } from "../../prisma/prisma.service";
import { Public, AllowDuringMaintenance } from "../../modules/identity";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @AllowDuringMaintenance()
  @Get()
  @HealthCheck()
  check() {
    // 5s, not terminus's 1s default: the DB is a cross-region Supabase pooler and the
    // instance is CPU-throttled, so a healthy-but-cold ping regularly took >1s — each
    // miss made Render's health check report 503 and treat the service as down.
    return this.health.check([() => this.prismaIndicator.pingCheck("database", this.prisma, { timeout: 5_000 })]);
  }
}
