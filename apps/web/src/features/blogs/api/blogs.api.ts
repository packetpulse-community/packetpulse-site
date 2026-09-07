import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { CreateCommentDto, CreateBlogPostDto, UpdateBlogPostDto } from "@packetpulse/types";

export interface BlogAuthor {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  coverImageUrl: string | null;
  viewCount: number;
  postedAt: string;
  isApproved: boolean;
  author: BlogAuthor;
  tags: { tag: string }[];
  _count: { likes: number; comments: number };
}

export interface BlogComment {
  id: string;
  content: string;
  createdAt: string;
  user: BlogAuthor;
}

export interface BlogImage {
  id: string;
  url: string;
  position: number;
}

export interface BlogPostDetail extends BlogPostSummary {
  comments: BlogComment[];
  images: BlogImage[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Server-side (Server Components) — forwards the incoming request's cookies (plan §6).
export const blogsServerApi = {
  list: (cookieHeader: string, query = "") => apiFetch<Paginated<BlogPostSummary>>(`/blogs${query}`, { cookieHeader }),
  featured: (cookieHeader: string) => apiFetch<BlogPostSummary[]>("/blogs/featured", { cookieHeader }),
  getBySlug: (slug: string, cookieHeader: string) => apiFetch<BlogPostDetail>(`/blogs/slug/${slug}`, { cookieHeader }),
  // No dedicated "related posts" endpoint exists — reuses the list endpoint filtered
  // to the current post's category, capped at 4 + the post itself so the caller can
  // drop a self-match and still have up to 4 real related posts to show.
  related: (category: string, excludeId: string, cookieHeader: string) =>
    apiFetch<Paginated<BlogPostSummary>>(`/blogs?category=${category}&limit=5`, { cookieHeader }).then((res) =>
      res.data.filter((p) => p.id !== excludeId).slice(0, 4),
    ),
};

// Client-side (mutations from "use client" components) — same-origin /api proxy (plan §6).
export const blogsClientApi = {
  addComment: (postId: string, dto: CreateCommentDto) =>
    apiFetchClient<BlogComment>(`/blogs/${postId}/comments`, { method: "POST", body: JSON.stringify(dto) }),
  toggleLike: (postId: string) => apiFetchClient<{ liked: boolean }>(`/blogs/${postId}/like`, { method: "PUT" }),
  create: (dto: CreateBlogPostDto) => apiFetchClient<BlogPostDetail>("/blogs", { method: "POST", body: JSON.stringify(dto) }),
  update: (id: string, dto: UpdateBlogPostDto) =>
    apiFetchClient<BlogPostDetail>(`/blogs/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  delete: (id: string) => apiFetchClient<{ success: boolean }>(`/blogs/${id}`, { method: "DELETE" }),
};
