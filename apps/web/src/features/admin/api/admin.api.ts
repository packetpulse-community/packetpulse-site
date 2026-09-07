import { apiFetch, apiFetchClient } from "@/shared/api/http-client";
import type { AssignRolesDto, AdminUserListQuery, AdminActivityAction, UpdateSiteSettingsDto } from "@packetpulse/types";

export interface SiteSettings {
  id: string;
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxUploadSizeMb: number;
  maxUserResourcesCount: number;
  emailVerificationRequired: boolean;
  adminEmail: string;
  apiRateLimit: number;
  sessionTimeoutMinutes: number;
  theme: "light" | "dark" | "system";
  logLevel: "debug" | "info" | "warn" | "error";
  updatedAt: string;
}

export interface ClientLogEntry {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  context: string | null;
  message: string;
  data: unknown;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ClientLogListQuery {
  level?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface SystemStatus {
  server: { status: "operational"; uptimeSeconds: number; nodeEnv: string; nodeVersion: string };
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  database: { status: "operational" | "down"; latencyMs: number };
  timestamp: string;
}

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
  lastLoginAt?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// fromDate/toDate are plain "YYYY-MM-DD" strings from <input type="date">, coerced
// to Date server-side by AdminDateRangeQuerySchema — kept as strings here rather
// than Date objects so toQueryString's String(value) serializes them correctly.
export interface AdminDateRangeQuery {
  fromDate?: string;
  toDate?: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  pendingApproval: number;
  totalBlogPosts: number;
  pendingBlogs: number;
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
  activityDistribution: { action: AdminActivityAction; count: number }[];
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

export interface PendingBlog {
  id: string;
  title: string;
  author: { firstName: string; lastName: string };
  createdAt?: string;
}

export interface AdminActivityLogEntry {
  id: string;
  action: AdminActivityAction;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string } | null;
}

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminServerApi = {
  pendingUsers: (cookieHeader: string) => apiFetch<AdminUser[]>("/admin/users/pending-approval", { cookieHeader }),
  stats: (cookieHeader: string, query: AdminDateRangeQuery = {}) =>
    apiFetch<AdminStats>(`/admin/stats${toQueryString(query)}`, { cookieHeader }),
  analytics: (cookieHeader: string, query: AdminDateRangeQuery = {}) =>
    apiFetch<AdminAnalytics>(`/admin/analytics${toQueryString(query)}`, { cookieHeader }),
  pendingResources: (cookieHeader: string) => apiFetch<PendingResource[]>("/admin/resources/pending", { cookieHeader }),
  pendingRecordings: (cookieHeader: string) => apiFetch<PendingRecording[]>("/admin/recordings/pending", { cookieHeader }),
  pendingBlogs: (cookieHeader: string) => apiFetch<PendingBlog[]>("/admin/blogs/pending", { cookieHeader }),
  listUsers: (cookieHeader: string, query: Partial<AdminUserListQuery>) =>
    apiFetch<PaginatedResponse<AdminUser>>(`/admin/users${toQueryString(query)}`, { cookieHeader }),
  getUser: (cookieHeader: string, id: string) => apiFetch<AdminUser>(`/admin/users/${id}`, { cookieHeader }),
  activity: (cookieHeader: string, query: { page?: number; limit?: number } = {}) =>
    apiFetch<PaginatedResponse<AdminActivityLogEntry>>(`/admin/activity${toQueryString(query)}`, { cookieHeader }),
  settings: (cookieHeader: string) => apiFetch<SiteSettings>("/admin/settings", { cookieHeader }),
  status: (cookieHeader: string) => apiFetch<SystemStatus>("/admin/status", { cookieHeader }),
  logs: (cookieHeader: string, query: ClientLogListQuery = {}) =>
    apiFetch<PaginatedResponse<ClientLogEntry>>(`/logs${toQueryString(query)}`, { cookieHeader }),
};

export const adminClientApi = {
  approveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/approve`, { method: "PUT" }),
  unapproveUser: (id: string) => apiFetchClient<AdminUser>(`/admin/users/${id}/unapprove`, { method: "PUT" }),
  approveResource: (id: string) => apiFetchClient(`/admin/resources/${id}/approve`, { method: "PUT" }),
  unapproveResource: (id: string) => apiFetchClient(`/admin/resources/${id}/unapprove`, { method: "PUT" }),
  approveRecording: (id: string) => apiFetchClient(`/admin/recordings/${id}/approve`, { method: "PUT" }),
  unapproveRecording: (id: string) => apiFetchClient(`/admin/recordings/${id}/unapprove`, { method: "PUT" }),
  approveBlog: (id: string) => apiFetchClient(`/admin/blogs/${id}/approve`, { method: "PUT" }),
  unapproveBlog: (id: string) => apiFetchClient(`/admin/blogs/${id}/unapprove`, { method: "PUT" }),
  listUsers: (query: Partial<AdminUserListQuery>) =>
    apiFetchClient<PaginatedResponse<AdminUser>>(`/admin/users${toQueryString(query)}`),
  assignRoles: (id: string, dto: AssignRolesDto) =>
    apiFetchClient<AdminUser>(`/admin/users/${id}/roles`, { method: "PUT", body: JSON.stringify(dto) }),
  deleteUser: (id: string) => apiFetchClient<{ success: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  stats: (query: AdminDateRangeQuery = {}) => apiFetchClient<AdminStats>(`/admin/stats${toQueryString(query)}`),
  analytics: (query: AdminDateRangeQuery = {}) =>
    apiFetchClient<AdminAnalytics>(`/admin/analytics${toQueryString(query)}`),
  activity: (query: { page?: number; limit?: number } = {}) =>
    apiFetchClient<PaginatedResponse<AdminActivityLogEntry>>(`/admin/activity${toQueryString(query)}`),
  updateSettings: (dto: UpdateSiteSettingsDto) =>
    apiFetchClient<SiteSettings>("/admin/settings", { method: "PUT", body: JSON.stringify(dto) }),
  status: () => apiFetchClient<SystemStatus>("/admin/status"),
};
