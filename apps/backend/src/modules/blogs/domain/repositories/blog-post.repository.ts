import { BlogCategory, Prisma } from "@prisma/client";
import { BlogPostDetail, BlogPostSummary } from "../entities/blog-post.entity";

export interface BlogPostFilter {
  category?: BlogCategory;
  tag?: string;
  search?: string;
}

// Blogs is a pilot module for the repository pattern alongside identity (plan §3).
export abstract class BlogPostRepository {
  abstract findMany(filter: BlogPostFilter, skip: number, take: number): Promise<[BlogPostSummary[], number]>;
  abstract findBySlug(slug: string): Promise<BlogPostDetail | null>;
  abstract findById(id: string): Promise<BlogPostDetail | null>;
  abstract create(authorId: string, data: Prisma.BlogPostCreateInput, tags: string[]): Promise<BlogPostDetail>;
  abstract update(id: string, data: Prisma.BlogPostUpdateInput, tags?: string[]): Promise<BlogPostDetail>;
  abstract delete(id: string): Promise<void>;
  abstract incrementViewCount(id: string): Promise<void>;
}
