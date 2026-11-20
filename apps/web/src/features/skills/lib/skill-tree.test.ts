import { describe, expect, it } from "vitest";
import type { Skill } from "@packetpulse/types";
import { buildTree, filterTree, pathLabel, skillMatches } from "./skill-tree";

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const skill = (n: number, name: string, level: Skill["level"], parentId: number | null, aliases: string[] = [], position = 0): Skill => ({
  id: id(n),
  name,
  level,
  parentId: parentId === null ? null : id(parentId),
  description: null,
  position,
  status: "active",
  aliases: aliases.map((alias, i) => ({ id: id(9 - i), alias })),
});

const skills = [
  skill(3, "OSPF", "micro", 2, ["Open Shortest Path First"]),
  skill(2, "Routing", "minor", 1),
  skill(1, "Networking", "major", null),
  skill(4, "BGP", "micro", 2, ["Border Gateway Protocol"], 1),
  skill(5, "Security", "major", null, [], 1),
  skill(6, "Orphan", "micro", 99),
];

describe("buildTree", () => {
  it("nests major > minor > micro, orders by position then name, and drops orphans", () => {
    const tree = buildTree(skills);
    expect(tree.map((n) => n.skill.name)).toEqual(["Networking", "Security"]);
    const routing = tree[0]!.children[0]!;
    expect(routing.skill.name).toBe("Routing");
    expect(routing.children.map((n) => n.skill.name)).toEqual(["OSPF", "BGP"]);
    expect(JSON.stringify(tree)).not.toContain("Orphan");
  });
});

describe("search", () => {
  it("matches names and aliases ignoring case and surrounding space", () => {
    expect(skillMatches(skills[0]!, "  ospf ")).toBe(true);
    expect(skillMatches(skills[0]!, "shortest path")).toBe(true);
    expect(skillMatches(skills[0]!, "bgp")).toBe(false);
    expect(skillMatches(skills[0]!, "")).toBe(true);
  });

  it("keeps a matching leaf under its parents and hides everything else", () => {
    const filtered = filterTree(buildTree(skills), "border gateway");
    expect(filtered.map((n) => n.skill.name)).toEqual(["Networking"]);
    expect(filtered[0]!.children[0]!.children.map((n) => n.skill.name)).toEqual(["BGP"]);
  });

  it("returns the whole tree for an empty query and nothing for no match", () => {
    expect(filterTree(buildTree(skills), "")).toHaveLength(2);
    expect(filterTree(buildTree(skills), "zzz")).toEqual([]);
  });
});

describe("pathLabel", () => {
  it("joins the ancestors", () => {
    expect(pathLabel(skills, id(3))).toBe("Networking › Routing › OSPF");
    expect(pathLabel(skills, id(1))).toBe("Networking");
    expect(pathLabel(skills, "nope")).toBe("");
  });
});
