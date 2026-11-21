import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { Paginated } from "@/features/blogs/api/blogs.api";
import type {
  ForumGuidelinesStatus,
  ForumGuidelinesView,
  ForumReportReason,
  ForumReportStatus,
  ForumReputation,
  ForumThreadMode,
} from "@packetpulse/types";

export type { ForumGuidelinesStatus, ForumGuidelinesView, ForumReportReason, ForumReportStatus, ForumReputation, ForumThreadMode };

export interface ForumAuthor {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Present on thread detail: total, level and accepted answers (text, never colour alone). */
  reputation?: ForumReputation;
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
  mode: ForumThreadMode;
  acceptedReplyId: string | null;
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
  removed: boolean;
  isAccepted: boolean;
}

export interface ForumThreadDetail extends Omit<ForumThreadSummary, "_count"> {
  replies: ForumReply[];
}

export interface ForumReportRow {
  id: string;
  status: ForumReportStatus;
  reason: ForumReportReason;
  details: string | null;
  urgent: boolean;
  createdAt: string;
  acknowledgeBy: string;
  overdue: boolean;
  reporter: { id: string; firstName: string; lastName: string };
  kind: "thread" | "reply";
  threadId: string | null;
  title: string | null;
  excerpt: string;
  contentRemoved: boolean;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: { id: string; firstName: string; lastName: string } | null;
}

/** The message the server gave (it is written for people), else a fallback. */
export function forumErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const body = (err as { body?: { message?: unknown } } | null)?.body;
  return typeof body?.message === "string" && body.message ? body.message : fallback;
}

export const forumsServerApi = {
  guidelines: (cookieHeader: string) => apiFetch<ForumGuidelinesView>("/forums/guidelines", { cookieHeader }),
  guidelinesStatus: (cookieHeader: string) => apiFetch<ForumGuidelinesStatus>("/forums/guidelines/status", { cookieHeader }),
  reputation: (userId: string, cookieHeader: string) => apiFetch<ForumReputation>(`/forums/reputation/${userId}`, { cookieHeader }),
  listReports: (cookieHeader: string, query = "") =>
    apiFetch<Paginated<ForumReportRow>>(`/forums/reports${query}`, { cookieHeader }),
  categories: (cookieHeader: string) => apiFetch<ForumCategory[]>("/forums/categories", { cookieHeader }),
  listThreads: (cookieHeader: string, query = "") =>
    apiFetch<Paginated<ForumThreadSummary>>(`/forums/threads${query}`, { cookieHeader }),
  getThread: (id: string, cookieHeader: string) => apiFetch<ForumThreadDetail>(`/forums/threads/${id}`, { cookieHeader }),
};

export const forumsClientApi = {
  createThread: (dto: { categoryId: string; title: string; content: string; mode: ForumThreadMode; sensitiveDataConfirmed: boolean }) =>
    apiFetchClient<ForumThreadDetail>("/forums/threads", { method: "POST", body: JSON.stringify(dto) }),
  addReply: (threadId: string, content: string) =>
    apiFetchClient<ForumReply>(`/forums/threads/${threadId}/replies`, { method: "POST", body: JSON.stringify({ content }) }),
  deleteReply: (threadId: string, replyId: string, reason?: string) =>
    apiFetchClient<{ success: boolean }>(`/forums/threads/${threadId}/replies/${replyId}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  toggleReplyLike: (replyId: string) => apiFetchClient<{ liked: boolean }>(`/forums/replies/${replyId}/like`, { method: "PUT" }),
  lockThread: (id: string, reason?: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/lock`, { method: "PUT", body: JSON.stringify({ reason }) }),
  unlockThread: (id: string, reason?: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/unlock`, { method: "PUT", body: JSON.stringify({ reason }) }),
  pinThread: (id: string, reason?: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/pin`, { method: "PUT", body: JSON.stringify({ reason }) }),
  unpinThread: (id: string, reason?: string) => apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}/unpin`, { method: "PUT", body: JSON.stringify({ reason }) }),
  updateThread: (id: string, dto: { title?: string; content?: string }) =>
    apiFetchClient<ForumThreadDetail>(`/forums/threads/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
  deleteThread: (id: string, reason?: string) =>
    apiFetchClient<{ success: boolean }>(`/forums/threads/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  acceptAnswer: (threadId: string, replyId: string, reason?: string) =>
    apiFetchClient<{ acceptedReplyId: string }>(`/forums/threads/${threadId}/accept/${replyId}`, { method: "PUT", body: JSON.stringify({ reason }) }),
  unacceptAnswer: (threadId: string, reason?: string) =>
    apiFetchClient<{ acceptedReplyId: null }>(`/forums/threads/${threadId}/accept`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  reportThread: (id: string, dto: { reason: ForumReportReason; details?: string }) =>
    apiFetchClient<{ id: string }>(`/forums/threads/${id}/report`, { method: "POST", body: JSON.stringify(dto) }),
  reportReply: (id: string, dto: { reason: ForumReportReason; details?: string }) =>
    apiFetchClient<{ id: string }>(`/forums/replies/${id}/report`, { method: "POST", body: JSON.stringify(dto) }),
  dismissReport: (id: string, reason: string) =>
    apiFetchClient<{ id: string }>(`/forums/reports/${id}/dismiss`, { method: "PUT", body: JSON.stringify({ reason }) }),
  removeReported: (id: string, reason: string) =>
    apiFetchClient<{ id: string }>(`/forums/reports/${id}/remove`, { method: "PUT", body: JSON.stringify({ reason }) }),
  guidelinesStatus: () => apiFetchClient<ForumGuidelinesStatus>("/forums/guidelines/status"),
  acceptGuidelines: () => apiFetchClient<ForumGuidelinesStatus>("/forums/guidelines/accept", { method: "POST" }),
  publishGuidelines: (dto: { body: string; reason: string }) =>
    apiFetchClient<ForumGuidelinesView>("/forums/guidelines", { method: "POST", body: JSON.stringify(dto) }),
};
