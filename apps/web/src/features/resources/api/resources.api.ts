import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Paginated } from "@/features/blogs/api/blogs.api";

export interface ResourceOwner {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ResourceSummary {
  id: string;
  title: string;
  description: string;
  resourceType: string;
  category: string;
  fileUrl: string | null;
  externalLink: string | null;
  thumbnailUrl: string | null;
  downloadable: boolean;
  premium: boolean;
  downloads: number;
  views: number;
  isApproved: boolean;
  createdAt: string;
  user: ResourceOwner;
  tags: { tag: string }[];
  _count: { likes: number };
}

// Server-side (Server Components) — forwards the incoming request's cookies.
export const resourcesServerApi = {
  list: (cookieHeader: string, query = "") => apiFetch<Paginated<ResourceSummary>>(`/resources${query}`, { cookieHeader }),
  getById: (id: string, cookieHeader: string) => apiFetch<ResourceSummary>(`/resources/${id}`, { cookieHeader }),
};

// Client-side (mutations) — same-origin /api proxy.
export const resourcesClientApi = {
  toggleLike: (id: string) => apiFetchClient<{ liked: boolean }>(`/resources/${id}/like`, { method: "PUT" }),
};
