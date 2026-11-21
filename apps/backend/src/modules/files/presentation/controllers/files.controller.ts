import { Body, Controller, Delete, Get, Ip, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FilesService } from "../../application/services/files.service";
import { CreateUploadUrlDto } from "../../application/dto/files.dto";
import { CurrentUser } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";
import { RequireFeature } from "../../../feature-flags/require-feature.decorator";

// Any approved, verified member; ownership is enforced in the service (non-owners get 404).
const FILE_TIER = { default: { limit: 30, ttl: 60_000 } };

@Controller("files")
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Throttle(FILE_TIER)
  @RequireFeature("files.uploads", "File uploads")
  @Post("upload-url")
  uploadUrl(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateUploadUrlDto, @Ip() ip: string) {
    return this.files.createUploadUrl({ sub: user.sub, roles: user.roles }, dto, ip);
  }

  @Throttle(FILE_TIER)
  @RequireFeature("files.uploads", "File uploads")
  @Post(":id/complete")
  complete(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.files.complete({ sub: user.sub, roles: user.roles }, id, ip);
  }

  @Throttle(FILE_TIER)
  @Get(":id/link")
  link(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.files.link({ sub: user.sub, roles: user.roles }, id, ip);
  }

  @Throttle(FILE_TIER)
  @Delete(":id")
  remove(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.files.remove({ sub: user.sub, roles: user.roles }, id, ip);
  }
}
