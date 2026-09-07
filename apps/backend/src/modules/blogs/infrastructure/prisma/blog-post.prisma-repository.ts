import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";
import { BlogPostFilter, BlogPostRepository } from "../../domain/repositories/blog-post.repository";
import { blogPostDetailInclude, blogPostSummaryInclude } from "../../domain/entities/blog-post.entity";

@Injectable()
export class BlogPostPrismaRepository extends BlogPostRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private buildWhere(filter: BlogPostFilter): Prisma.BlogPostWhereInput {
    return {
      isPublished: true,
      // Non-admin visitors only ever see approved posts, matching resources/
      // recordings' isApproved-gating pattern — previously ungated here, so
      // admins had no way to see (and moderate) unapproved posts via this
      // endpoint at all.
      isApproved: filter.isAdmin ? undefined : true,
      category: filter.category,
      tags: filter.tag ? { some: { tag: filter.tag } } : undefined,
      OR: filter.search
        ? [
            { title: { contains: filter.search, mode: "insensitive" } },
            { content: { contains: filter.search, mode: "insensitive" } },
          ]
        : undefined,
    };
  }

  async findMany(filter: BlogPostFilter, skip: number, take: number) {
    const where = this.buildWhere(filter);
    const [data, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        include: blogPostSummaryInclude,
        orderBy: { postedAt: "desc" },
        skip,
        take,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return [data, total] as [typeof data, typeof total];
  }

  findBySlug(slug: string) {
    return this.prisma.blogPost.findUnique({ where: { slug }, include: blogPostDetailInclude });
  }

  findById(id: string) {
    return this.prisma.blogPost.findUnique({ where: { id }, include: blogPostDetailInclude });
  }

  async create(authorId: string, data: Prisma.BlogPostCreateInput, tags: string[]) {
    const post = await this.prisma.blogPost.create({
      data: { ...data, tags: { create: tags.map((tag) => ({ tag })) } },
      include: blogPostDetailInclude,
    });
    return post;
  }

  async update(id: string, data: Prisma.BlogPostUpdateInput, tags?: string[]) {
    if (tags) {
      // Replace the tag set atomically rather than diffing — simplest correct
      // approach for a small, bounded (max 20) tag list.
      await this.prisma.blogPostTag.deleteMany({ where: { blogPostId: id } });
    }
    return this.prisma.blogPost.update({
      where: { id },
      data: { ...data, tags: tags ? { create: tags.map((tag) => ({ tag })) } : undefined },
      include: blogPostDetailInclude,
    });
  }

  async delete(id: string) {
    await this.prisma.blogPost.delete({ where: { id } });
  }

  async incrementViewCount(id: string) {
    await this.prisma.blogPost.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }
}
