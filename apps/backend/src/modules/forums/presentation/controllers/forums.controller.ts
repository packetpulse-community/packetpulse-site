import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ForumThreadsService } from "../../application/services/forum-threads.service";
import { ForumRepliesService } from "../../application/services/forum-replies.service";
import { CreateForumThreadDto, CreateForumReplyDto, ForumThreadListQueryDto } from "../../application/dto/forums.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

@Controller("forums")
export class ForumsController {
  constructor(
    private readonly threads: ForumThreadsService,
    private readonly replies: ForumRepliesService,
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
  @Post("threads")
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateForumThreadDto) {
    return this.threads.create(user.sub, dto);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/lock")
  lock(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.threads.setLocked(id, user.sub, user.roles, true);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/unlock")
  unlock(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.threads.setLocked(id, user.sub, user.roles, false);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/pin")
  pin(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.threads.setPinned(id, user.sub, user.roles, true);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_MODERATE)
  @Put("threads/:id/unpin")
  unpin(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.threads.setPinned(id, user.sub, user.roles, false);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.FORUMS_CREATE)
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
  ) {
    await this.replies.remove(id, replyId, user.sub, user.roles);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Put("replies/:replyId/like")
  toggleLike(@Param("replyId") replyId: string, @CurrentUser() user: AccessTokenPayload) {
    return this.replies.toggleLike(replyId, user.sub);
  }
}
