import type { DataRequestStatus, DataRequestView, RetentionRule } from "@packetpulse/types";
import type { StatusTone } from "@/shared/ui/primitives/StatusChip";

// Pure helpers for the data-rights screens (SCR-038), so the wording and the states are tested
// without rendering. Times are shown in IST, as Document 3 section 7 asks.

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${dateTimeFormat.format(d)} IST`;
}

export interface RequestState {
  tone: StatusTone;
  /** Short chip text. */
  label: string;
  /** One sentence for the member. */
  text: string;
}

// The seven states of an export request, in the member's words.
export function exportState(r: DataRequestView | null, availableDays: number): RequestState {
  if (!r) return { tone: "neutral", label: "No export yet", text: "You have not asked for a copy of your data." };
  switch (r.status) {
    case "requested":
      return { tone: "information", label: "Requested", text: "We received your request and will start preparing it in a moment." };
    case "preparing":
      return { tone: "information", label: "Preparing", text: "We are putting your data together. You can leave this page: we will email you when it is ready." };
    case "ready":
      return { tone: "success", label: "Ready", text: `Your download is ready until ${formatDate(r.expiresAt)}. It is a zip of JSON files. After that you can ask again.` };
    case "expired":
      return { tone: "neutral", label: "Expired", text: `The download was available for ${availableDays} days and has been removed. You can ask for a new one.` };
    case "cancelled":
      return { tone: "neutral", label: "Discarded", text: "You discarded this export and the file was removed. You can ask for a new one." };
    case "failed":
      return { tone: "danger", label: "Could not be prepared", text: "Something went wrong while preparing your data. Nothing was lost; please ask again." };
    default:
      return { tone: "neutral", label: r.status, text: "" };
  }
}

export const exportIsOpen = (r: DataRequestView | null) => !!r && ["requested", "preparing", "ready"].includes(r.status);
export const exportIsWorking = (r: DataRequestView | null) => !!r && (r.status === "requested" || r.status === "preparing");

// The states of a deletion request.
export function erasureState(r: DataRequestView | null, graceDays: number): RequestState {
  if (!r) return { tone: "neutral", label: "Not requested", text: `Deleting your account takes effect after a ${graceDays}-day wait, and you can cancel any time before then.` };
  switch (r.status) {
    case "scheduled":
      return { tone: "warning", label: "Scheduled", text: `Your account is deactivated and will be deleted on ${formatDate(r.scheduledFor)}. Until then you can cancel and everything comes back.` };
    case "cancelled":
      return { tone: "neutral", label: "Cancelled", text: `You cancelled the deletion on ${formatDate(r.cancelledAt)}. Your account is active.` };
    case "completed":
      return { tone: "neutral", label: "Completed", text: `Your account was deleted on ${formatDate(r.completedAt)}.` };
    default:
      return { tone: "neutral", label: r.status, text: "" };
  }
}

export const erasureIsScheduled = (r: DataRequestView | null) => r?.status === "scheduled";

export function periodText(rule: Pick<RetentionRule, "days" | "from">): string {
  if (rule.days === null) return "No automatic limit";
  if (rule.days % 365 === 0) {
    const years = rule.days / 365;
    return `${years} ${years === 1 ? "year" : "years"} after ${rule.from}`;
  }
  return `${rule.days} days after ${rule.from}`;
}

// What an admin reads in the list.
export const ADMIN_STATUS_LABEL: Record<DataRequestStatus, string> = {
  requested: "Requested",
  preparing: "Preparing",
  ready: "Ready",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  failed: "Failed",
};

const AUDIT_LABEL: Record<string, string> = {
  data_export_requested: "Export requested",
  data_export_ready: "Export ready",
  data_export_downloaded: "Export downloaded",
  data_export_discarded: "Export discarded",
  data_export_expired: "Export expired",
  account_deletion_requested: "Deletion requested",
  account_deletion_cancelled: "Deletion cancelled",
  account_erased: "Account erased",
};
export const auditLabel = (action: string) => AUDIT_LABEL[action] ?? action.replace(/_/g, " ");

export function adminTone(status: DataRequestStatus): StatusTone {
  if (status === "failed") return "danger";
  if (status === "scheduled") return "warning";
  if (status === "ready" || status === "completed") return "success";
  if (status === "requested" || status === "preparing") return "information";
  return "neutral";
}
