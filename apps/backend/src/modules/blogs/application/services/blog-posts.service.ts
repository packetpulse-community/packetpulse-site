import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BlogPostRepository } from "../../domain/repositories/blog-post.repository";
import { PrismaService } from "../../../../prisma/prisma.service";
import { paginate, prismaSkip } from "../../../../common/dto/pagination.util";
import { slugify } from "../../../../common/utils/slugify";
import { CreateBlogPostDto, UpdateBlogPostDto, BlogListQueryDto } from "../dto/blogs.dto";
import { SUPER_ADMIN_ROLE } from "../../../identity";

@Injectable()
export class BlogPostsService {
  constructor(
    private readonly posts: BlogPostRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: BlogListQueryDto) {
    const skip = prismaSkip(query.page, query.limit);
    const [data, total] = await this.posts.findMany(
      { category: query.category, tag: query.tag, search: query.search },
      skip,
      query.limit,
    );
    return paginate(data, query.page, query.limit, total);
  }

  async featured() {
    const [data] = await this.posts.findMany({}, 0, 5);
    return data;
  }

  async getBySlug(slug: string) {
    const post = await this.posts.findBySlug(slug);
    if (!post) throw new NotFoundException("Blog post not found");
    await this.posts.incrementViewCount(post.id);
    return post;
  }

  async getById(id: string) {
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundException("Blog post not found");
    await this.posts.incrementViewCount(id);
    return post;
  }

  async create(authorId: string, dto: CreateBlogPostDto) {
    const slug = await this.uniqueSlug(dto.title);
    return this.posts.create(
      authorId,
      {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        coverImageUrl: dto.coverImageUrl,
        slug,
        author: { connect: { id: authorId } },
      },
      dto.tags,
    );
  }

  async update(id: string, userId: string, roles: string[], dto: UpdateBlogPostDto) {
    const existing = await this.posts.findById(id);
    if (!existing) throw new NotFoundException("Blog post not found");
    this.assertOwnerOrAdmin(existing.authorId, userId, roles);

    return this.posts.update(
      id,
      {
        title: dto.title,
        content: dto.content,
        category: dto.category,
        coverImageUrl: dto.coverImageUrl,
        slug: dto.title ? await this.uniqueSlug(dto.title, id) : undefined,
      },
      dto.tags,
    );
  }

  async delete(id: string, userId: string, roles: string[]) {
    const existing = await this.posts.findById(id);
    if (!existing) throw new NotFoundException("Blog post not found");
    this.assertOwnerOrAdmin(existing.authorId, userId, roles);
    await this.posts.delete(id);
  }

  private assertOwnerOrAdmin(ownerId: string, userId: string, roles: string[]) {
    const isOwner = ownerId === userId;
    const isAdmin = roles.includes("admin") || roles.includes(SUPER_ADMIN_ROLE);
    if (!isOwner && !isAdmin) throw new ForbiddenException("You do not own this post");
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let candidate = base;
    let suffix = 1;
    // Small bounded loop — collisions are rare (title-derived slugs), and this
    // avoids a race-prone "check then insert" pattern spanning a whole request.
    while (await this.slugTaken(candidate, excludeId)) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  private async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    return !!existing && existing.id !== excludeId;
  }
}
