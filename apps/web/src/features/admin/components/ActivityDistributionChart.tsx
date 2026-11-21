import type { AdminActivityAction } from "@packetpulse/types";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";

interface ActivityDistributionChartProps {
  data: { action: AdminActivityAction; count: number }[];
}

const ACTION_LABELS: Record<AdminActivityAction, string> = {
  user_approved: "User approvals",
  user_unapproved: "User unapprovals",
  user_roles_changed: "Role changes",
  user_deleted: "User deletions",
  resource_approved: "Resource approvals",
  resource_unapproved: "Resource unapprovals",
  recording_approved: "Recording approvals",
  recording_unapproved: "Recording unapprovals",
  blog_approved: "Blog approvals",
  blog_unapproved: "Blog unapprovals",
  forum_thread_locked: "Thread locks",
  forum_thread_unlocked: "Thread unlocks",
  forum_thread_pinned: "Thread pins",
  forum_thread_unpinned: "Thread unpins",
  forum_thread_deleted: "Thread deletions",
  quiz_created: "Quizzes created",
  quiz_updated: "Quiz updates",
  quiz_deleted: "Quiz deletions",
  user_data_cleaned: "User data clean-ups",
  users_data_bulk_cleaned: "Bulk data clean-ups",
  site_settings_changed: "Settings changes",
  admin_registered: "Admin sign-ups",
};

// Segment colours come from the Grove tokens (module and state colours), which have separate
// light and dark values. Colour is never the only cue: every segment has a text legend with its
// count and share, a native <title> tooltip and a thin surface-coloured gap between segments.
const SEGMENT_CLASSES = [
  { stroke: "stroke-module-community", swatch: "bg-module-community" },
  { stroke: "stroke-module-learning", swatch: "bg-module-learning" },
  { stroke: "stroke-module-recruitment", swatch: "bg-module-recruitment" },
  { stroke: "stroke-module-payments", swatch: "bg-module-payments" },
  { stroke: "stroke-warning", swatch: "bg-warning" },
  { stroke: "stroke-danger", swatch: "bg-danger" },
  { stroke: "stroke-info", swatch: "bg-info" },
];

const SEGMENT_GAP = 2;

const RADIUS = 60;
const STROKE_WIDTH = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function segmentClass(i: number) {
  return SEGMENT_CLASSES[i % SEGMENT_CLASSES.length] ?? SEGMENT_CLASSES[0]!;
}

// Real donut chart built from the new admin_activity_logs table, grouped by action
// type — the old dashboard's "Activity Distribution" pie read a field the backend
// never sent and always rendered 4 hardcoded placeholder-colored quadrants with no
// labels or real data behind them (confirmed via code audit).
export function ActivityDistributionChart({ data }: ActivityDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        as="h3"
        title="No admin activity yet"
        description="Admin actions are counted here once they happen."
        action={{ label: "View logs", href: "/admin/logs" }}
      />
    );
  }

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Admin activity by action type; see the list beside the chart for the values">
        {data.map((segment, i) => {
          const fraction = segment.count / total;
          const full = fraction * CIRCUMFERENCE;
          const dash = Math.max(full - (data.length > 1 ? SEGMENT_GAP : 0), 0.5);
          const offset = cumulative;
          cumulative += full;
          const { stroke } = segmentClass(i);
          return (
            <circle
              key={segment.action}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              className={stroke}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${ACTION_LABELS[segment.action]}: ${segment.count}`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        {data.map((segment, i) => (
          <li key={segment.action} className="flex items-center gap-2">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${segmentClass(i).swatch}`} />
            <span className="text-text">{ACTION_LABELS[segment.action]}</span>
            <span className="text-text-secondary">
              {segment.count} ({Math.round((segment.count / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
