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

export const notificationsApi = {
  // Paginated (API-038). The bell asks for the newest 20.
  list: (page = 1, pageSize = 20) =>
    apiFetchClient<NotificationListResponse>(`/notifications?page=${page}&pageSize=${pageSize}`),
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
