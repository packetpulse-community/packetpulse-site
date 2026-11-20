// Shared by the bell and the notifications page: one sentence per notification, and where it leads.
export function describeNotification(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case "forum_reply":
      return `New reply on "${payload.threadTitle ?? "your thread"}"`;
    case "blog_comment":
      return `New comment on "${payload.blogPostTitle ?? "your post"}"`;
    case "approval":
      return payload.approved ? "Your account was approved" : "Your account approval was revoked";
    case "role_change":
      return "Your account roles changed";
    case "certificate_issued":
      return `Certificate issued for "${payload.quizTitle ?? "a quiz"}"`;
    case "security_alert":
      return "Security alert on your account";
    default:
      return "You have a new notification";
  }
}

// Only routes that exist today; undefined = the notification has no page to open.
export function notificationHref(type: string, payload: Record<string, unknown>): string | undefined {
  if (type === "forum_reply" && typeof payload.threadId === "string") return `/forums/${payload.threadId}`;
  if (type === "certificate_issued") return "/certificates";
  return undefined;
}
