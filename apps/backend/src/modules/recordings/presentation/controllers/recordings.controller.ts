import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RecordingsService } from "../../application/services/recordings.service";
import { CreateRecordingDto, UpdateRecordingDto, RecordingListQueryDto } from "../../application/dto/recordings.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS, SUPER_ADMIN_ROLE } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

function isAdminRoles(roles: string[]) {
  return roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
}

@Controller("recordings")
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Public()
  @Get()
  list(@Query() query: RecordingListQueryDto, @CurrentUser() user?: AccessTokenPayload) {
    return this.recordings.list(query, !!user && isAdminRoles(user.roles));
  }

  @Public()
  @Get(":id")
  getById(@Param("id") id: string, @CurrentUser() user?: AccessTokenPayload) {
    return this.recordings.getById(id, !!user && isAdminRoles(user.roles));
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.RECORDINGS_CREATE)
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateRecordingDto) {
    return this.recordings.create(user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id")
  update(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateRecordingDto) {
    return this.recordings.update(id, user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete(":id")
  @HttpCode(200)
  async remove(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.recordings.delete(id, user.sub, user.roles);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id/like")
  toggleLike(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.recordings.toggleLike(id, user.sub);
  }

  // The old app defined a joinRecording controller function but never wired it to a
  // route (dead feature despite the model having a participants relation, per the
  // migration audit) — wired up properly here.
  @Throttle(WRITE_STANDARD)
  @Post(":id/join")
  join(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.recordings.join(id, user.sub);
  }
}
