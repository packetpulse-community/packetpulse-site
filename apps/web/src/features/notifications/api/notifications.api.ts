import { apiFetchClient } from "@/shared/api/http-client";

export interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: () => apiFetchClient<Notification[]>("/notifications"),
  unreadCount: () => apiFetchClient<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => apiFetchClient<{ success: boolean }>(`/notifications/${id}/read`, { method: "PUT" }),
};
