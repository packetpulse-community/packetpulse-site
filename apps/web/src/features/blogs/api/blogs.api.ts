import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { CreateCommentDto } from "@packetpulse/types";

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
  viewCount: number;
  postedAt: string;
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

export interface BlogPostDetail extends BlogPostSummary {
  comments: BlogComment[];
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
  getBySlug: (slug: string, cookieHeader: string) => apiFetch<BlogPostDetail>(`/blogs/slug/${slug}`, { cookieHeader }),
};

// Client-side (mutations from "use client" components) — same-origin /api proxy (plan §6).
export const blogsClientApi = {
  addComment: (postId: string, dto: CreateCommentDto) =>
    apiFetchClient<BlogComment>(`/blogs/${postId}/comments`, { method: "POST", body: JSON.stringify(dto) }),
  toggleLike: (postId: string) => apiFetchClient<{ liked: boolean }>(`/blogs/${postId}/like`, { method: "PUT" }),
};
