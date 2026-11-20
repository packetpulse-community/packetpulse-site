"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { notificationsApi } from "../api/notifications.api";
import { describeNotification, notificationHref } from "../lib/describe";
import { Button } from "@/shared/ui/primitives/Button";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton } from "@/shared/ui/primitives/Skeleton";

const PAGE_SIZE = 20;

const timeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

// SCR-013: the member's notifications, newest first, with an unread marker and "Mark all read".
export function NotificationsList() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications", "list", page],
    queryFn: () => notificationsApi.list(page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast.error("Could not mark your notifications as read. Try again."),
  });
  const markOne = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (isPending) {
    return (
      <div role="status" aria-label="Loading notifications" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="We could not load your notifications."
        description="Check your connection and try again. Your notifications are safe."
        retry={{ label: "Try again", onClick: () => void refetch() }}
      />
    );
  }
  if (data.total === 0) {
    return (
      <EmptyState
        icon={<Bell />}
        title="No notifications yet."
        description="Replies to your threads, comments on your posts, approvals and certificates will show up here."
        action={{ label: "Go to the dashboard", href: "/dashboard" }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {data.unreadCount === 0 ? "You are all caught up." : `${data.unreadCount} unread`}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={data.unreadCount === 0 || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {markAll.isPending ? "Marking…" : "Mark all read"}
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {data.items.map((n) => {
          const unread = n.readAt === null;
          const href = notificationHref(n.type, n.payload);
          const text = describeNotification(n.type, n.payload);
          return (
            <li key={n.id} className="glass-panel flex items-start gap-3 rounded-lg px-4 py-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-indigo-600" : "border border-input"}`}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className={unread ? "font-semibold" : "text-muted-foreground"}>
                  {unread && <span className="sr-only">Unread: </span>}
                  {href ? (
                    <Link href={href} onClick={() => unread && markOne.mutate(n.id)} className="underline-offset-4 hover:underline">
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </p>
                <time dateTime={n.createdAt} className="text-xs text-muted-foreground">
                  {timeFormat.format(new Date(n.createdAt))}
                </time>
              </div>
              {unread && (
                <button
                  type="button"
                  onClick={() => markOne.mutate(n.id)}
                  className="shrink-0 text-xs text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
                >
                  Mark read
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <nav aria-label="Notification pages" className="flex items-center justify-center gap-3">
          <Button variant="glass" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="glass" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
