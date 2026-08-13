import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { NetworkToolsService } from "../../application/services/network-tools.service";
import { RunNetworkToolDto } from "../../application/dto/network-tools.dto";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

@Controller("network-tools")
export class NetworkToolsController {
  constructor(private readonly tools: NetworkToolsService) {}

  @Throttle(WRITE_STANDARD)
  @Post("run")
  run(@Body() dto: RunNetworkToolDto) {
    return this.tools.run(dto);
  }
}
