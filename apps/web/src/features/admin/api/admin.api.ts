import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { AssignRolesDto, AdminUserListQuery } from "@packetpulse/types";

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isApproved: boolean;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
  createdAt?: string;
}

export interface PendingRecording {
  id: string;
  title: string;
  instructor: { firstName: string; lastName: string };
  createdAt?: string;
}

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminServerApi = {
  pendingUsers: (cookieHeader: string) => apiFetch<AdminUser[]>("/admin/users/pending-approval", { cookieHeader }),
  stats: (cookieHeader: string) => apiFetch<AdminStats>("/admin/stats", { cookieHeader }),
  analytics: (cookieHeader: string) => apiFetch<AdminAnalytics>("/admin/analytics", { cookieHeader }),
  pendingResources: (cookieHeader: string) => apiFetch<PendingResource[]>("/admin/resources/pending", { cookieHeader }),
  pendingRecordings: (cookieHeader: string) => apiFetch<PendingRecording[]>("/admin/recordings/pending", { cookieHeader }),
  listUsers: (cookieHeader: string, query: Partial<AdminUserListQuery>) =>
    apiFetch<PaginatedResponse<AdminUser>>(`/admin/users${toQueryString(query)}`, { cookieHeader }),
  getUser: (cookieHeader: string, id: string) => apiFetch<AdminUser>(`/admin/users/${id}`, { cookieHeader }),
};

export const adminClientApi = {
  approveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/approve`, { method: "PUT" }),
  unapproveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/unapprove`, { method: "PUT" }),
  approveResource: (id: string) => apiFetchClient(`/admin/resources/${id}/approve`, { method: "PUT" }),
  approveRecording: (id: string) => apiFetchClient(`/admin/recordings/${id}/approve`, { method: "PUT" }),
  listUsers: (query: Partial<AdminUserListQuery>) =>
    apiFetchClient<PaginatedResponse<AdminUser>>(`/admin/users${toQueryString(query)}`),
  assignRoles: (id: string, dto: AssignRolesDto) =>
    apiFetchClient<AdminUser>(`/admin/users/${id}/roles`, { method: "PUT", body: JSON.stringify(dto) }),
  deleteUser: (id: string) => apiFetchClient<{ success: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
};
