import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class BlogLikesService {
  constructor(private readonly prisma: PrismaService) {}

  async toggle(blogPostId: string, userId: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id: blogPostId }, select: { id: true } });
    if (!post) throw new NotFoundException("Blog post not found");

    const existing = await this.prisma.blogLike.findUnique({
      where: { blogPostId_userId: { blogPostId, userId } },
    });

    if (existing) {
      await this.prisma.blogLike.delete({ where: { blogPostId_userId: { blogPostId, userId } } });
      return { liked: false };
    }

    await this.prisma.blogLike.create({ data: { blogPostId, userId } });
    return { liked: true };
  }
}
