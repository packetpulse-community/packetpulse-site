import { Module } from "@nestjs/common";
import { BlogsController } from "./presentation/controllers/blogs.controller";
import { BlogPostsService } from "./application/services/blog-posts.service";
import { BlogCommentsService } from "./application/services/blog-comments.service";
import { BlogLikesService } from "./application/services/blog-likes.service";
import { BlogPostRepository } from "./domain/repositories/blog-post.repository";
import { BlogPostPrismaRepository } from "./infrastructure/prisma/blog-post.prisma-repository";

@Module({
  controllers: [BlogsController],
  providers: [
    BlogPostsService,
    BlogCommentsService,
    BlogLikesService,
    { provide: BlogPostRepository, useClass: BlogPostPrismaRepository },
  ],
})
export class BlogsModule {}
