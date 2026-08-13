import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "../../application/services/dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("stats")
  stats() {
    return this.dashboard.stats();
  }
}
