import type { AdminActivityAction } from "@packetpulse/types";

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
};

// Segment colors from the design system's real palette (indigo/cyan/yellow/
// green/red/purple), not CSS-variable tokens — matching how the reference
// project itself colors things.
const SEGMENT_CLASSES = [
  { stroke: "stroke-indigo-500", swatch: "bg-indigo-500" },
  { stroke: "stroke-cyan-400", swatch: "bg-cyan-400" },
  { stroke: "stroke-yellow-500", swatch: "bg-yellow-500" },
  { stroke: "stroke-green-500", swatch: "bg-green-500" },
  { stroke: "stroke-red-500", swatch: "bg-red-500" },
  { stroke: "stroke-purple-500", swatch: "bg-purple-500" },
  { stroke: "stroke-blue-400", swatch: "bg-blue-400" },
];

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
    return <p className="text-muted-foreground">No admin activity recorded yet.</p>;
  }

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
        {data.map((segment, i) => {
          const fraction = segment.count / total;
          const dash = fraction * CIRCUMFERENCE;
          const offset = cumulative;
          cumulative += dash;
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
              <title>
                {ACTION_LABELS[segment.action]}: {segment.count}
              </title>
            </circle>
          );
        })}
      </svg>
      <ul className="flex flex-col gap-2 text-sm">
        {data.map((segment, i) => (
          <li key={segment.action} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${segmentClass(i).swatch}`} />
            <span className="text-foreground">{ACTION_LABELS[segment.action]}</span>
            <span className="text-muted-foreground">({segment.count})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
