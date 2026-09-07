import { apiFetch } from "@/shared/api/http-client";

export interface DashboardStats {
  real: {
    totalUsers: number;
    totalBlogPosts: number;
    totalResources: number;
    totalRecordings: number;
    totalForumThreads: number;
    onlineCount: number;
  };
  // Explicitly mocked network-monitoring figures — the backend labels these
  // `simulated` on purpose (no real network probing happens server-side); the
  // UI must keep that label visible rather than presenting them as live data.
  simulated: {
    networks: number;
    devicesMonitored: number;
    activeAlerts: number;
    uptimePct: number;
  };
}

export const dashboardServerApi = {
  stats: (cookieHeader: string) => apiFetch<DashboardStats>("/dashboard/stats", { cookieHeader }),
};
