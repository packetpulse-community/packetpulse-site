import type { Skill, SkillLevel } from "@packetpulse/types";

// Pure helpers shared by the member picker and the admin page (unit-tested in skill-tree.test.ts).

export interface SkillNode<T extends Skill = Skill> {
  skill: T;
  children: SkillNode<T>[];
}

const LEVEL_ORDER: Record<SkillLevel, number> = { major: 0, minor: 1, micro: 2 };

/** Groups a flat list into Major > Minor > Micro. Skills whose parent is missing from the list are left out. */
export function buildTree<T extends Skill>(skills: readonly T[]): SkillNode<T>[] {
  const nodes = new Map<string, SkillNode<T>>(skills.map((s) => [s.id, { skill: s, children: [] }]));
  const roots: SkillNode<T>[] = [];
  for (const node of nodes.values()) {
    if (node.skill.parentId === null) roots.push(node);
    else nodes.get(node.skill.parentId)?.children.push(node);
  }
  const sort = (list: SkillNode<T>[]) => {
    list.sort((a, b) => a.skill.position - b.skill.position || a.skill.name.localeCompare(b.skill.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

/** Does the skill's name or any alias contain the query (case-insensitive)? An empty query matches all. */
export function skillMatches(skill: Skill, query: string): boolean {
  const q = norm(query);
  if (q === "") return true;
  return norm(skill.name).includes(q) || skill.aliases.some((a) => norm(a.alias).includes(q));
}

/** Keeps a node when it or any descendant matches, so a hit is always shown under its parents. */
export function filterTree<T extends Skill>(tree: readonly SkillNode<T>[], query: string): SkillNode<T>[] {
  if (norm(query) === "") return [...tree];
  const out: SkillNode<T>[] = [];
  for (const node of tree) {
    const children = filterTree(node.children, query);
    if (skillMatches(node.skill, query) || children.length > 0) out.push({ skill: node.skill, children });
  }
  return out;
}

export function levelLabel(level: SkillLevel): string {
  return { major: "Major", minor: "Minor", micro: "Micro" }[level];
}

export function sortByLevel<T extends Skill>(skills: readonly T[]): T[] {
  return [...skills].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name));
}

/** "Networking › Routing › OSPF" for a skill id, for compact lists. */
export function pathLabel(skills: readonly Skill[], id: string): string {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const parts: string[] = [];
  for (let cur = byId.get(id); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) parts.unshift(cur.name);
  return parts.join(" › ");
}
