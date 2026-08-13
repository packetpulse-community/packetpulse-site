import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { BlogPostsService } from "../../application/services/blog-posts.service";
import { BlogCommentsService } from "../../application/services/blog-comments.service";
import { BlogLikesService } from "../../application/services/blog-likes.service";
import { CreateBlogPostDto, UpdateBlogPostDto, CreateCommentDto, BlogListQueryDto } from "../../application/dto/blogs.dto";
import { Public, CurrentUser, RequirePermission, PERMISSIONS } from "../../../identity";
import type { AccessTokenPayload } from "../../../identity";

// write-standard tier (plan §4): 100 requests/15min for authenticated writes.
const WRITE_STANDARD = { default: { limit: 100, ttl: 900_000 } };

@Controller("blogs")
export class BlogsController {
  constructor(
    private readonly posts: BlogPostsService,
    private readonly comments: BlogCommentsService,
    private readonly likes: BlogLikesService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: BlogListQueryDto) {
    return this.posts.list(query);
  }

  @Public()
  @Get("featured")
  featured() {
    return this.posts.featured();
  }

  @Public()
  @Get("slug/:slug")
  getBySlug(@Param("slug") slug: string) {
    return this.posts.getBySlug(slug);
  }

  @Throttle(WRITE_STANDARD)
  @RequirePermission(PERMISSIONS.BLOGS_CREATE)
  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateBlogPostDto) {
    return this.posts.create(user.sub, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id")
  update(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload, @Body() dto: UpdateBlogPostDto) {
    return this.posts.update(id, user.sub, user.roles, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete(":id")
  @HttpCode(200)
  async remove(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    await this.posts.delete(id, user.sub, user.roles);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Post(":id/comments")
  addComment(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.add(id, user.sub, dto);
  }

  @Throttle(WRITE_STANDARD)
  @Delete(":id/comments/:commentId")
  @HttpCode(200)
  async removeComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    await this.comments.remove(id, commentId, user.sub, user.roles);
    return { success: true };
  }

  @Throttle(WRITE_STANDARD)
  @Put(":id/like")
  toggleLike(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.likes.toggle(id, user.sub);
  }

  // Kept last so it doesn't shadow the more specific routes above (featured, slug/:slug).
  @Public()
  @Get(":id")
  getById(@Param("id") id: string) {
    return this.posts.getById(id);
  }
}
