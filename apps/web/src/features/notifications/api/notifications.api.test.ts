import { describe, expect, it } from "vitest";
import type { NotificationListResponse } from "@packetpulse/types";
import { normalizeNotificationList, type Notification } from "./notifications.api";

const n = (id: string, readAt: string | null): Notification => ({ id, type: "approval", payload: {}, readAt, createdAt: "2026-11-21T00:00:00Z" });

describe("normalizeNotificationList", () => {
  it("keeps the new paginated shape as it is", () => {
    const res = { items: [], unreadCount: 3, page: 2, pageSize: 20, total: 41 } as unknown as NotificationListResponse;
    expect(normalizeNotificationList(res)).toBe(res);
  });

  it("wraps the old bare array (previous backend) and counts unread", () => {
    const out = normalizeNotificationList([n("a", null), n("b", "2026-11-21T01:00:00Z"), n("c", null)]);
    expect(out.items).toHaveLength(3);
    expect(out.unreadCount).toBe(2);
    expect(out.total).toBe(3);
    expect(out.page).toBe(1);
  });

  it("handles an empty old array", () => {
    expect(normalizeNotificationList([])).toMatchObject({ items: [], unreadCount: 0, total: 0 });
  });
});
