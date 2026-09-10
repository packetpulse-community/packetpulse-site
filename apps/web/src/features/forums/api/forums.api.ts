import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Paginated } from "@/features/blogs/api/blogs.api";

export interface ForumAuthor {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
}

export interface ForumThreadSummary {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  slug: string;
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  replyCount: number;
  lastReplyAt: string;
  author: ForumAuthor;
  category: ForumCategory;
  _count: { replies: number };
}

export interface ForumReply {
  id: string;
  content: string;
  parentReplyId: string | null;
  createdAt: string;
  author: ForumAuthor;
  _count: { likes: number };
}

export interface ForumThreadDetail extends Omit<ForumThreadSummary, "_count"> {
  replies: ForumReply[];
}

export const forumsServerApi = {
  categories: (cookieHeader: string) => apiFetch<ForumCategory[]>("/forums/categories", { cookieHeader }),
  listThreads: (cookieHeader: string, query = "") =>
    apiFetch<Paginated<ForumThreadSummary>>(`/forums/threads${query}`, { cookieHeader }),
  getThread: (id: string, cookieHeader: string) => apiFetch<ForumThreadDetail>(`/forums/threads/${id}`, { cookieHeader }),
};

export const forumsClientApi = {
  createThread: (dto: { categoryId: string; title: string; content: string }) =>
    apiFetchClient<ForumThreadDetail>("/forums/threads", { method: "POST", body: JSON.stringify(dto) }),
  addReply: (threadId: string, content: string) =>
    apiFetchClient<ForumReply>(`/forums/threads/${threadId}/replies`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteReply: (threadId: string, replyId: string) =>
    apiFetchClient<{ success: boolean }>(`/forums/threads/${threadId}/replies/${replyId}`, { method: "DELETE" }),
  toggleReplyLike: (replyId: string) => apiFetchClient<{ liked: boolean }>(`/forums/replies/${replyId}/like`, { method: "PUT" }),
  lockThread: (id: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/lock`, { method: "PUT" }),
  unlockThread: (id: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/unlock`, { method: "PUT" }),
  pinThread: (id: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/pin`, { method: "PUT" }),
  unpinThread: (id: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/unpin`, { method: "PUT" }),
  updateThread: (id: string, dto: { title?: string; content?: string }) =>
    apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  deleteThread: (id: string) => apiFetchClient<{ success: boolean }>(`/forums/threads/${id}`, { method: "DELETE" }),
};
