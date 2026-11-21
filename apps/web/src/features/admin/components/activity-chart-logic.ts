// Pure helpers for the admin activity donut. The backend records more action types than the
// shared enum lists (skills, categories, deleted content...), so the chart must cope with
// actions that have no friendly label, and with far more types than it has distinct colours.

/** Distinct segment colours before the rest are folded into "Other". */
export const MAX_NAMED_SEGMENTS = 6;

export interface ActivitySegmentInput {
  action: string;
  count: number;
}

export interface ActivitySegment {
  key: string;
  label: string;
  count: number;
  isOther: boolean;
}

/** "skill_suggestion_added" -> "Skill suggestion added" when no friendly label exists. */
export function humaniseAction(action: string): string {
  const words = action.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

/**
 * Largest segments first, at most MAX_NAMED_SEGMENTS named ones, the remainder summed into one
 * "Other" segment. Zero-count entries are dropped. `labels` supplies friendly names.
 */
export function buildActivitySegments(
  data: ActivitySegmentInput[],
  labels: Partial<Record<string, string>>,
): ActivitySegment[] {
  const sorted = data
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
  const named = sorted.slice(0, MAX_NAMED_SEGMENTS).map((d) => ({
    key: d.action,
    label: labels[d.action] ?? humaniseAction(d.action),
    count: d.count,
    isOther: false,
  }));
  const rest = sorted.slice(MAX_NAMED_SEGMENTS);
  if (rest.length === 0) return named;
  return [
    ...named,
    {
      key: "__other__",
      label: `Other (${rest.length} types)`,
      count: rest.reduce((sum, d) => sum + d.count, 0),
      isOther: true,
    },
  ];
}
