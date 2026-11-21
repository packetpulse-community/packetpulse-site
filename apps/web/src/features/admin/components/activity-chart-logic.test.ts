import { describe, expect, it } from "vitest";
import { buildActivitySegments, humaniseAction, MAX_NAMED_SEGMENTS } from "./activity-chart-logic";

describe("humaniseAction", () => {
  it("turns a snake_case action into a sentence", () => {
    expect(humaniseAction("skill_suggestion_added")).toBe("Skill suggestion added");
  });
});

describe("buildActivitySegments", () => {
  it("sorts by count, uses friendly labels and falls back for unknown actions", () => {
    const out = buildActivitySegments(
      [
        { action: "user_approved", count: 2 },
        { action: "skill_created", count: 9 },
      ],
      { user_approved: "User approvals" },
    );
    expect(out.map((s) => s.label)).toEqual(["Skill created", "User approvals"]);
  });

  it("folds everything beyond the named limit into one Other segment with the summed count", () => {
    const data = Array.from({ length: MAX_NAMED_SEGMENTS + 3 }, (_, i) => ({ action: `a_${i}`, count: 10 - i }));
    const out = buildActivitySegments(data, {});
    expect(out).toHaveLength(MAX_NAMED_SEGMENTS + 1);
    const other = out[out.length - 1]!;
    expect(other.isOther).toBe(true);
    expect(other.label).toBe("Other (3 types)");
    expect(other.count).toBe(data.slice(MAX_NAMED_SEGMENTS).reduce((s, d) => s + d.count, 0));
  });

  it("drops zero counts and adds no Other segment when everything fits", () => {
    const out = buildActivitySegments([{ action: "x", count: 0 }, { action: "y", count: 3 }], {});
    expect(out.map((s) => s.key)).toEqual(["y"]);
  });
});
