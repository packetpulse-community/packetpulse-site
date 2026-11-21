import { BadRequestException, Body, Controller, Delete, Get, Ip, Param, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ResumesService } from "../application/resumes.service";
import { CreateResumeUploadBodyDto, DecideSuggestionBodyDto } from "../application/resumes.dto";
import { CurrentUser } from "../../identity";
import type { AccessTokenPayload } from "../../identity";

// Any approved, verified member; every query is scoped to the caller, so another member's resume,
// suggestions or entries look exactly like ones that do not exist (404). Switch: resumes.upload.
const RESUME_TIER = { default: { limit: 30, ttl: 60_000 } };
const UPLOAD_TIER = { default: { limit: 10, ttl: 60_000 } };

@Controller("resumes")
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Throttle(RESUME_TIER)
  @Get()
  overview(@CurrentUser() user: AccessTokenPayload) {
    return this.resumes.overview(user.sub);
  }

  @Throttle(UPLOAD_TIER)
  @Post("upload-url")
  start(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateResumeUploadBodyDto, @Ip() ip: string) {
    return this.resumes.startUpload({ sub: user.sub, roles: user.roles }, dto, ip);
  }

  @Throttle(RESUME_TIER)
  @Get("profile-entries")
  entries(@CurrentUser() user: AccessTokenPayload) {
    return this.resumes.entries(user.sub);
  }

  @Throttle(RESUME_TIER)
  @Delete("profile-entries/:kind/:id")
  removeEntry(@CurrentUser() user: AccessTokenPayload, @Param("kind") kind: string, @Param("id") id: string) {
    if (kind !== "education" && kind !== "experience") throw new BadRequestException("Unknown entry type");
    return this.resumes.removeEntry(user.sub, kind, id);
  }

  @Throttle(RESUME_TIER)
  @Put("suggestions/:suggestionId")
  decide(@CurrentUser() user: AccessTokenPayload, @Param("suggestionId") suggestionId: string, @Body() dto: DecideSuggestionBodyDto) {
    return this.resumes.decide(user.sub, suggestionId, dto.decision);
  }

  @Throttle(UPLOAD_TIER)
  @Post(":id/complete")
  complete(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.resumes.complete({ sub: user.sub, roles: user.roles }, id, ip);
  }

  @Throttle(UPLOAD_TIER)
  @Post(":id/retry")
  retry(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    return this.resumes.retry({ sub: user.sub, roles: user.roles }, id);
  }

  @Throttle(RESUME_TIER)
  @Get(":id/link")
  link(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.resumes.link({ sub: user.sub, roles: user.roles }, id, ip);
  }

  @Throttle(RESUME_TIER)
  @Delete(":id")
  remove(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string, @Ip() ip: string) {
    return this.resumes.remove({ sub: user.sub, roles: user.roles }, id, ip);
  }
}
