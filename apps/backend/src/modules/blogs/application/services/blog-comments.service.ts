import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { CreateCommentDto } from "../dto/blogs.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";
import { NotificationsService } from "../../../notifications";

@Injectable()
export class BlogCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async add(blogPostId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.blogPost.findUnique({ where: { id: blogPostId }, select: { id: true, authorId: true, title: true } });
    if (!post) throw new NotFoundException("Blog post not found");

    const comment = await this.prisma.blogComment.create({
      data: { blogPostId, userId, content: dto.content },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    if (post.authorId !== userId) {
      await this.notifications.notify(post.authorId, "blog_comment", {
        blogPostId,
        blogPostTitle: post.title,
        commentId: comment.id,
        fromUserId: userId,
      });
    }

    return comment;
  }

  async remove(blogPostId: string, commentId: string, userId: string, roles: string[]) {
    const comment = await this.prisma.blogComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.blogPostId !== blogPostId) throw new NotFoundException("Comment not found");

    const isOwner = comment.userId === userId;
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    if (!isOwner && !isAdmin) throw new ForbiddenException("You do not own this comment");

    await this.prisma.blogComment.delete({ where: { id: commentId } });
  }
}
