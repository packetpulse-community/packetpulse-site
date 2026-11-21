"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  DEFAULT_SKILL_VISIBILITY,
  MAX_MEMBER_SKILLS,
  SKILL_VISIBILITIES,
  type MemberSkill,
  type Skill,
  type SkillVisibility,
} from "@packetpulse/types";
import { skillsClientApi } from "../api/skills.api";
import { buildTree, filterTree, pathLabel, type SkillNode } from "../lib/skill-tree";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { ApiError } from "@/shared/api/http-client";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const VISIBILITY_LABEL: Record<SkillVisibility, string> = {
  public: "Public",
  members: "Signed-in members",
  private: "Only me",
};

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

interface Props {
  taxonomy: Skill[];
  initial: MemberSkill[];
  /** Called with the saved selection (the onboarding flow uses it to re-check what is missing). */
  onSaved?: (rows: MemberSkill[]) => void;
}

// Member skill picker: search the taxonomy (names and aliases), tick up to 25 skills, choose who
// sees each one, save. Every skill is "Self declared" until evidence exists (PRD-012) and the
// label says so. A name that is not in the taxonomy goes to the suggestion queue instead.
export function SkillPicker({ taxonomy, initial, onSaved }: Props) {
  const [selected, setSelected] = useState<Map<string, SkillVisibility>>(
    () => new Map(initial.map((s) => [s.skillId, s.visibility])),
  );
  const [saved, setSaved] = useState(() => serialise(new Map(initial.map((s) => [s.skillId, s.visibility]))));
  const [query, setQuery] = useState("");
  const [suggestion, setSuggestion] = useState("");

  const tree = useMemo(() => buildTree(taxonomy), [taxonomy]);
  const visible = useMemo(() => filterTree(tree, query), [tree, query]);
  const byId = useMemo(() => new Map(taxonomy.map((s) => [s.id, s])), [taxonomy]);
  const atLimit = selected.size >= MAX_MEMBER_SKILLS;
  const dirty = serialise(selected) !== saved;

  const save = useMutation({
    mutationFn: () => skillsClientApi.setMine({ skills: [...selected].map(([skillId, visibility]) => ({ skillId, visibility })) }),
    onSuccess: (rows) => {
      const next = new Map(rows.map((r) => [r.skillId, r.visibility]));
      setSelected(next);
      setSaved(serialise(next));
      toast.success("Skills saved");
      onSaved?.(rows);
    },
    onError: (err) => toast.error(message(err, "Could not save your skills")),
  });

  const suggest = useMutation({
    mutationFn: (name: string) => skillsClientApi.suggest(name),
    onSuccess: (res) => {
      const text = {
        created: "Thanks. An admin will review this skill.",
        counted: "Thanks. Others have asked for this skill too.",
        already_counted: "You have already suggested this skill.",
        exists: "That skill is already in the list. Search for it above.",
      }[res.outcome];
      toast.success(text);
      setSuggestion("");
    },
    onError: (err) => toast.error(message(err, "Could not send your suggestion")),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_MEMBER_SKILLS) next.set(id, DEFAULT_SKILL_VISIBILITY);
      return next;
    });
  }

  function setVisibility(id: string, visibility: SkillVisibility) {
    setSelected((prev) => new Map(prev).set(id, visibility));
  }

  function renderNode(node: SkillNode, depth: number) {
    const { skill } = node;
    const checked = selected.has(skill.id);
    return (
      <li key={skill.id}>
        <label
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        >
          <input
            type="checkbox"
            checked={checked}
            disabled={!checked && atLimit}
            onChange={() => toggle(skill.id)}
            aria-label={pathLabel(taxonomy, skill.id)}
          />
          <span className={skill.level === "major" ? "font-semibold" : undefined}>{skill.name}</span>
          {skill.aliases.length > 0 && (
            <span className="text-xs text-muted-foreground">also: {skill.aliases.map((a) => a.alias).join(", ")}</span>
          )}
        </label>
        {node.children.length > 0 && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="skill-search" className="text-sm font-medium">
          Find a skill
        </label>
        <input
          id="skill-search"
          type="search"
          className={inputClass}
          placeholder="e.g. OSPF, firewall, VPC"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border border-border p-2">
        {visible.length > 0 ? (
          <ul>{visible.map((n) => renderNode(n, 0))}</ul>
        ) : (
          <p className="p-2 text-sm text-muted-foreground">
            {taxonomy.length === 0 ? "No skills have been added yet." : "No skill matches. You can suggest it below."}
          </p>
        )}
      </div>

      <section aria-labelledby="my-skills-heading" className="flex flex-col gap-2">
        <h3 id="my-skills-heading" className="text-sm font-medium">
          Your skills ({selected.size} of {MAX_MEMBER_SKILLS})
        </h3>
        {selected.size === 0 ? (
          <p className="text-sm text-muted-foreground">You have not picked any skills yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...selected].map(([id, visibility]) => (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{byId.get(id)?.name ?? "Unknown skill"}</span>
                <Badge variant="outline" size="sm">
                  Self declared
                </Badge>
                <span className="ml-auto flex items-center gap-2">
                  <label className="sr-only" htmlFor={`vis-${id}`}>
                    Who can see {byId.get(id)?.name}
                  </label>
                  <select
                    id={`vis-${id}`}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={visibility}
                    onChange={(e) => setVisibility(id, e.target.value as SkillVisibility)}
                  >
                    {SKILL_VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABEL[v]}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => toggle(id)} aria-label={`Remove ${byId.get(id)?.name ?? "skill"}`}>
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {atLimit && <p className="text-sm text-muted-foreground">You have reached the limit of {MAX_MEMBER_SKILLS} skills. Remove one to add another.</p>}
        <div>
          <Button type="button" variant="gradient" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save skills"}
          </Button>
        </div>
      </section>

      <form
        className="flex flex-col gap-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (suggestion.trim().length >= 2) suggest.mutate(suggestion);
        }}
      >
        <label htmlFor="skill-suggest" className="text-sm font-medium">
          Can&apos;t find your skill?
        </label>
        <p className="text-sm text-muted-foreground">Suggest it and an admin will review it. It does not appear on your profile until it is added.</p>
        <div className="flex gap-2">
          <input id="skill-suggest" className={inputClass} value={suggestion} maxLength={80} onChange={(e) => setSuggestion(e.target.value)} />
          <Button type="submit" variant="outline" disabled={suggestion.trim().length < 2 || suggest.isPending}>
            Suggest
          </Button>
        </div>
      </form>
    </div>
  );
}

function serialise(m: Map<string, SkillVisibility>) {
  return JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
}
