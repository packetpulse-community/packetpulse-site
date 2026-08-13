import { apiFetch, apiFetchClient } from "@/shared/api/http-client";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isApproved: boolean;
  emailVerified: boolean;
  roles: string[];
}

export interface AdminStats {
  totalUsers: number;
  pendingApproval: number;
  totalBlogPosts: number;
  totalResources: number;
  pendingResources: number;
  totalRecordings: number;
  pendingRecordings: number;
  totalForumThreads: number;
  totalQuizzes: number;
  certificatesIssued: number;
}

export interface AdminAnalytics {
  registrationTrend: { date: string; count: number }[];
  roleDistribution: { role: string; count: number }[];
}

export interface PendingResource {
  id: string;
  title: string;
  resourceType: string;
  user: { firstName: string; lastName: string };
}

export interface PendingRecording {
  id: string;
  title: string;
  instructor: { firstName: string; lastName: string };
}

export const adminServerApi = {
  pendingUsers: (cookieHeader: string) => apiFetch<AdminUser[]>("/admin/users/pending-approval", { cookieHeader }),
  stats: (cookieHeader: string) => apiFetch<AdminStats>("/admin/stats", { cookieHeader }),
  analytics: (cookieHeader: string) => apiFetch<AdminAnalytics>("/admin/analytics", { cookieHeader }),
  pendingResources: (cookieHeader: string) => apiFetch<PendingResource[]>("/admin/resources/pending", { cookieHeader }),
  pendingRecordings: (cookieHeader: string) => apiFetch<PendingRecording[]>("/admin/recordings/pending", { cookieHeader }),
};

export const adminClientApi = {
  approveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/approve`, { method: "PUT" }),
  unapproveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/unapprove`, { method: "PUT" }),
  approveResource: (id: string) => apiFetchClient(`/admin/resources/${id}/approve`, { method: "PUT" }),
  approveRecording: (id: string) => apiFetchClient(`/admin/recordings/${id}/approve`, { method: "PUT" }),
};
