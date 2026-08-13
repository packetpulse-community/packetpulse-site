"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationsApi } from "../api/notifications.api";
import { useRealtime } from "@/shared/hooks/useRealtime";

function describeNotification(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "forum_reply":
      return `New reply on "${payload.threadTitle ?? "your thread"}"`;
    case "blog_comment":
      return `New comment on "${payload.blogPostTitle ?? "your post"}"`;
    case "approval":
      return payload.approved ? "Your account was approved" : "Your account approval was revoked";
    case "certificate_issued":
      return `Certificate issued for "${payload.quizTitle ?? "a quiz"}"`;
    default:
      return "You have a new notification";
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
  });

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.unreadCount,
  });

  useRealtime((payload) => {
    const n = payload as { type: string; payload: Record<string, unknown> };
    toast(describeNotification(n.type, n.payload));
  });

  async function handleMarkRead(id: string) {
    await notificationsApi.markRead(id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative text-muted-foreground hover:text-primary">
        🔔
        {!!unread?.count && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            {unread.count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-lg border border-border bg-card p-2 text-card-foreground shadow-xl">
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {notifications?.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full rounded px-2 py-2 text-left text-sm hover:bg-accent ${n.readAt ? "text-muted-foreground" : "font-medium"}`}
                >
                  {describeNotification(n.type, n.payload)}
                </button>
              </li>
            ))}
            {(!notifications || notifications.length === 0) && (
              <li className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
