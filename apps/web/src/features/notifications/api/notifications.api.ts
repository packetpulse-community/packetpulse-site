import type {
  ConfirmWhatsappNumberInput,
  NotificationListResponse,
  NotificationPreferencesView,
  UpdateNotificationPreferencesInput,
} from "@packetpulse/types";
import { apiFetchClient } from "@/shared/api/http-client";

export interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

// The list route used to return a bare array and now returns { items, unreadCount, page, pageSize,
// total }. The web app (Vercel) and the backend (Render) deploy separately, so for a few minutes
// a new web build can talk to the previous backend. Accept both shapes so the bell keeps working
// through that window. Remove the array branch once both sides are deployed everywhere.
export function normalizeNotificationList(res: NotificationListResponse | Notification[]): NotificationListResponse {
  if (!Array.isArray(res)) return res;
  return {
    items: res as unknown as NotificationListResponse["items"],
    unreadCount: res.filter((n) => !n.readAt).length,
    page: 1,
    pageSize: res.length,
    total: res.length,
  };
}

export const notificationsApi = {
  // Paginated (API-038). The bell asks for the newest 20.
  list: async (page = 1, pageSize = 20) =>
    normalizeNotificationList(
      await apiFetchClient<NotificationListResponse | Notification[]>(`/notifications?page=${page}&pageSize=${pageSize}`),
    ),
  unreadCount: () => apiFetchClient<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => apiFetchClient<{ success: boolean }>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () => apiFetchClient<{ updated: number }>("/notifications/read-all", { method: "PUT" }),
  getPreferences: () => apiFetchClient<NotificationPreferencesView>("/notifications/preferences"),
  updatePreferences: (dto: UpdateNotificationPreferencesInput) =>
    apiFetchClient<NotificationPreferencesView>("/notifications/preferences", { method: "PUT", body: JSON.stringify(dto) }),
  confirmWhatsappNumber: (dto: ConfirmWhatsappNumberInput) =>
    apiFetchClient<{ status: "pending"; numberMasked: string | null; requestedAt: string; providerConfigured: boolean }>(
      "/notifications/whatsapp/confirm-number",
      { method: "POST", body: JSON.stringify(dto) },
    ),
};
