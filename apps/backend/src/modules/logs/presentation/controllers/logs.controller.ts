import { Body, Controller, Get, Headers, Ip, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { LogsService } from "../../application/services/logs.service";
import { CreateClientLogDto, ClientLogListQueryDto } from "../../application/dto/logs.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const INGEST_TIER = { default: { limit: 60, ttl: 60_000 } };

@Controller("logs")
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Public()
  @Throttle(INGEST_TIER)
  @Post()
  create(
    @Body() dto: CreateClientLogDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string | undefined,
    @CurrentUser() user?: AccessTokenPayload,
  ) {
    return this.logs.create(dto, { userId: user?.sub, ip, userAgent });
  }

  @RequirePermission(PERMISSIONS.ADMIN_VIEW_ANALYTICS)
  @Get()
  list(@Query() query: ClientLogListQueryDto) {
    return this.logs.list(query);
  }
}
