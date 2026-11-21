import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ForumThreadsService } from "../../application/services/forum-threads.service";
import { ForumRepliesService } from "../../application/services/forum-replies.service";
import { ForumGuidelinesService } from "../../application/services/forum-guidelines.service";
import { ForumReportsService } from "../../application/services/forum-reports.service";
import { ForumReputationService } from "../../application/services/forum-reputation.service";
import {
  CreateForumThreadDto,
  CreateForumReplyDto,
  ForumThreadListQueryDto,
  UpdateForumThreadDto,
  CreateForumReportDto,
  ForumReasonDto,
  ForumOptionalReasonDto,
  ForumReportListQueryDto,
  PublishForumGuidelinesDto,
} from "../../application/dto/forums.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";
import { RequireFeature } from "../../../feature-flags/require-feature.decorator";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

@Controller("forums")
export class ForumsController {
  constructor(
    private readonly threads: ForumThreadsService,
    private readonly replies: ForumRepliesService,
    private readonly guidelines: ForumGuidelinesService,
    private readonly reports: ForumReportsService,
    private readonly reputation: ForumReputationService,
  ) {}

  @Public()
  @Get("categories")
  categories() {
    return this.threads.categories();
  }

  @Public()
  @Get("threads")
  list(@Query() query: ForumThreadListQueryDto) {
    return this.threads.list(query);
  }

  @Public()
  @Get("threads/:id")
  getById(@Param("id") id: string) {
    return this.threads.getById(id);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_CREATE)
  @RequireFeature("forums.posting", "Forum posting")
  @Post("threads")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateForumThreadDto) {
    return this.threads.create(user.sub, dto);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/lock")
  lock(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.setLocked(id, user.sub, user.roles, true, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/unlock")
  unlock(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.setLocked(id, user.sub, user.roles, false, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/pin")
  pin(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.setPinned(id, user.sub, user.roles, true, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/unpin")
  unpin(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.setPinned(id, user.sub, user.roles, false, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @Put("threads/:id")
  update(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateForumThreadDto) {
    return this.threads.update(id, user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete("threads/:id")
  @HttpCode(200)
  deleteThread(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.delete(id, user.sub, user.roles, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_CREATE)
  @RequireFeature("forums.posting", "Forum posting")
  @Post("threads/:id/replies")
  addReply(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateForumReplyDto,
  ) {
    return this.replies.add(id, user.sub, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete("threads/:id/replies/:replyId")
  @HttpCode(200)
  async removeReply(
    @Param("id") id: string,
    @Param("replyId") replyId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ForumOptionalReasonDto,
  ) {
    await this.replies.remove(id, replyId, user.sub, user.roles, dto.reason);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Put("replies/:replyId/like")
  toggleLike(@Param("replyId") replyId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.replies.toggleLike(replyId, user.sub);
  }

  // ---- accepted answer (PRD-025) ------------------------------------------------------------------
  @Throttle(WRITE_STANDARD)
  @Put("threads/:id/accept/:replyId")
  accept(
    @Param("id") id: string,
    @Param("replyId") replyId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ForumOptionalReasonDto,
  ) {
    return this.threads.accept(id, replyId, user.sub, user.roles, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @Delete("threads/:id/accept")
  @HttpCode(200)
  unaccept(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumOptionalReasonDto) {
    return this.threads.unaccept(id, user.sub, user.roles, dto.reason);
  }

  // ---- reports (PRD-025, API-023) -----------------------------------------------------------------
  @Throttle(WRITE_STANDARD)
  @Post("threads/:id/report")
  reportThread(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: CreateForumReportDto) {
    return this.reports.create(user.sub, { threadId: id }, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Post("replies/:replyId/report")
  reportReply(@Param("replyId") replyId: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: CreateForumReportDto) {
    return this.reports.create(user.sub, { replyId }, dto);
  }

  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Get("reports")
  listReports(@Query() query: ForumReportListQueryDto) {
    return this.reports.list(query);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("reports/:id/dismiss")
  dismissReport(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumReasonDto) {
    return this.reports.dismiss(id, user.sub, dto.reason);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("reports/:id/remove")
  removeReported(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: ForumReasonDto) {
    return this.reports.remove(id, user.sub, dto.reason);
  }

  // ---- guidelines (PRD-054, DB-030) ---------------------------------------------------------------
  @Public()
  @Get("guidelines")
  currentGuidelines() {
    return this.guidelines.current();
  }

  @Get("guidelines/status")
  guidelinesStatus(@CurrentUser() user: AccessTokenPayload) {
    return this.guidelines.status(user.sub);
  }

  @Throttle(WRITE_STANDARD)
  @Post("guidelines/accept")
  @HttpCode(200)
  acceptGuidelines(@CurrentUser() user: AccessTokenPayload) {
    return this.guidelines.accept(user.sub);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.ADMIN_MANAGE_SETTINGS)
  @Post("guidelines")
  publishGuidelines(@CurrentUser() user: AccessTokenPayload, @Body() dto: PublishForumGuidelinesDto) {
    return this.guidelines.publish(user.sub, dto);
  }

  // ---- reputation (PRD-026) -----------------------------------------------------------------------
  @Get("reputation/:userId")
  reputationOf(@Param("userId") userId: string) {
    return this.reputation.forUser(userId);
  }
}
