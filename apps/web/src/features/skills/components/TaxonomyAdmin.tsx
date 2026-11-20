"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { AUDIT_REASON_MIN_LENGTH, type SkillLevel, type SkillSuggestion } from "@packetpulse/types";
import { skillsClientApi, type AdminSkill, type AdminTaxonomy } from "../api/skills.api";
import { buildTree, filterTree, levelLabel, pathLabel, type SkillNode } from "../lib/skill-tree";
import { Button } from "@/shared/ui/primitives/Button";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Card } from "@/shared/ui/primitives/Card";
import { Dialog } from "@/shared/ui/primitives/Dialog";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { ApiError } from "@/shared/api/http-client";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? ((err.body as { message?: string })?.message ?? fallback) : fallback;
}

type Action =
  | { kind: "create"; parentId?: string; level?: SkillLevel }
  | { kind: "rename"; skill: AdminSkill }
  | { kind: "alias"; skill: AdminSkill }
  | { kind: "retire"; skill: AdminSkill }
  | { kind: "add-suggestion"; suggestion: SkillSuggestion }
  | { kind: "merge-suggestion"; suggestion: SkillSuggestion }
  | { kind: "reject-suggestion"; suggestion: SkillSuggestion };

const CHILD_LEVEL: Record<SkillLevel, SkillLevel | null> = { major: "minor", minor: "micro", micro: null };
const PARENT_LEVEL: Record<SkillLevel, SkillLevel | null> = { major: null, minor: "major", micro: "minor" };

export function TaxonomyAdmin({ taxonomy, suggestions }: { taxonomy: AdminTaxonomy; suggestions: SkillSuggestion[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const tree = useMemo(() => buildTree(taxonomy.skills), [taxonomy.skills]);
  const shown = useMemo(() => filterTree(tree, query), [tree, query]);

  const refreshing = {
    onSuccess: () => router.refresh(),
    onError: (err: unknown) => toast.error(message(err, "That did not work")),
  };
  const restore = useMutation({ mutationFn: (id: string) => skillsClientApi.restore(id), ...refreshing });
  const removeAlias = useMutation({
    mutationFn: (v: { id: string; aliasId: string }) => skillsClientApi.removeAlias(v.id, v.aliasId),
    ...refreshing,
  });

  function renderNode(node: SkillNode<AdminSkill>, depth: number) {
    const { skill } = node;
    const childLevel = CHILD_LEVEL[skill.level];
    return (
      <li key={skill.id}>
        <div className="flex flex-wrap items-center gap-2 py-2" style={{ paddingLeft: `${depth * 1.5}rem` }}>
          <span className={skill.level === "major" ? "font-semibold" : "font-medium"}>{skill.name}</span>
          <Badge variant="outline" size="sm">
            {levelLabel(skill.level)}
          </Badge>
          {skill.status === "retired" && (
            <Badge variant="secondary" size="sm">
              Retired
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{skill.memberCount} member(s)</span>
          {skill.aliases.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              {a.alias}
              <button
                type="button"
                aria-label={`Remove alias ${a.alias}`}
                className="rounded hover:text-destructive"
                onClick={() => removeAlias.mutate({ id: skill.id, aliasId: a.id })}
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="ml-auto flex flex-wrap gap-1">
            {childLevel && skill.status === "active" && (
              <Button variant="outline" size="sm" onClick={() => setAction({ kind: "create", parentId: skill.id, level: childLevel })}>
                Add {childLevel}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setAction({ kind: "alias", skill })} aria-label={`Add alias to ${skill.name}`}>
              Alias
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAction({ kind: "rename", skill })} aria-label={`Edit ${skill.name}`}>
              Edit
            </Button>
            {skill.status === "active" ? (
              <Button variant="outline" size="sm" onClick={() => setAction({ kind: "retire", skill })} aria-label={`Retire ${skill.name}`}>
                Retire
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled={restore.isPending} onClick={() => restore.mutate(skill.id)} aria-label={`Restore ${skill.name}`}>
                Restore
              </Button>
            )}
          </span>
        </div>
        {node.children.length > 0 && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="tax-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="tax-heading" className="text-lg font-semibold">
              Skills
            </h2>
            <p className="text-sm text-muted-foreground">
              Taxonomy version {taxonomy.version}. Every change raises the version and is written to the audit log.
            </p>
          </div>
          <Button variant="gradient" onClick={() => setAction({ kind: "create" })}>
            <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
            New skill
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-skill-search" className="text-sm font-medium">
            Search skills and aliases
          </label>
          <input id="admin-skill-search" type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Card variant="glass" className="p-4">
          {shown.length > 0 ? (
            <ul className="divide-y divide-border">{shown.map((n) => renderNode(n, 0))}</ul>
          ) : (
            <EmptyState
              title={taxonomy.skills.length === 0 ? "No skills yet" : "No skill matches"}
              description={
                taxonomy.skills.length === 0
                  ? "Members pick skills from this list. Start with a major area such as Networking, then add minor and micro skills under it."
                  : "Try a different word, or check the alias spelling."
              }
              action={{ label: "New skill", onClick: () => setAction({ kind: "create" }) }}
              className="border-0"
            />
          )}
        </Card>
      </section>

      <section aria-labelledby="sug-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="sug-heading" className="text-lg font-semibold">
            Suggestions ({suggestions.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Names members typed that are not in the list. A clear match to an existing skill joins it as an alias on its own after{" "}
            {taxonomy.autoMergeThreshold} different members suggest it.
          </p>
        </div>
        <Card variant="glass" className="flex flex-col divide-y divide-border p-0">
          {suggestions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="font-medium">{s.name}</span>
              <Badge variant="outline" size="sm">
                {s.sightings} {s.sightings === 1 ? "member" : "members"}
              </Badge>
              {s.matchSkillId && (
                <span className="text-xs text-muted-foreground">Looks like {pathLabel(taxonomy.skills, s.matchSkillId)}</span>
              )}
              <span className="ml-auto flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setAction({ kind: "add-suggestion", suggestion: s })} aria-label={`Add ${s.name} as a skill`}>
                  Add
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction({ kind: "merge-suggestion", suggestion: s })} aria-label={`Merge ${s.name} into a skill`}>
                  Merge
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction({ kind: "reject-suggestion", suggestion: s })} aria-label={`Reject ${s.name}`}>
                  Reject
                </Button>
              </span>
            </div>
          ))}
          {suggestions.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nothing waiting. New suggestions from members appear here.</p>
          )}
        </Card>
      </section>

      {action && <ActionDialog action={action} taxonomy={taxonomy} onClose={() => setAction(null)} onDone={() => { setAction(null); router.refresh(); }} />}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionDialog({
  action,
  taxonomy,
  onClose,
  onDone,
}: {
  action: Action;
  taxonomy: AdminTaxonomy;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(
    action.kind === "rename" ? action.skill.name : action.kind === "add-suggestion" ? action.suggestion.name : "",
  );
  const [level, setLevel] = useState<SkillLevel>(action.kind === "create" ? (action.level ?? "major") : "major");
  const [parentId, setParentId] = useState(action.kind === "create" ? (action.parentId ?? "") : "");
  const [reason, setReason] = useState("");
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState("");

  const parentLevel = PARENT_LEVEL[level];
  const parents = taxonomy.skills.filter((s) => s.level === parentLevel && s.status === "active");
  const active = taxonomy.skills.filter((s) => s.status === "active");
  const reasonOk = reason.trim().length >= AUDIT_REASON_MIN_LENGTH;

  const run = useMutation({
    mutationFn: async () => {
      switch (action.kind) {
        case "create":
          return skillsClientApi.create({ name, level, parentId: parentLevel ? parentId : undefined });
        case "rename":
          return skillsClientApi.update(action.skill.id, { name });
        case "alias":
          return skillsClientApi.addAlias(action.skill.id, name);
        case "retire":
          return skillsClientApi.retire(action.skill.id, reason);
        case "add-suggestion":
          return skillsClientApi.addSuggestion(action.suggestion.id, { level, parentId: parentLevel ? parentId : undefined, name });
        case "merge-suggestion":
          return skillsClientApi.mergeSuggestion(action.suggestion.id, targetId);
        case "reject-suggestion":
          return skillsClientApi.rejectSuggestion(action.suggestion.id, reason);
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      onDone();
    },
    onError: (err) => setError(message(err, "That did not work")),
  });

  const title = {
    create: "New skill",
    rename: `Edit ${action.kind === "rename" ? action.skill.name : ""}`,
    alias: `Add an alias to ${action.kind === "alias" ? action.skill.name : ""}`,
    retire: `Retire ${action.kind === "retire" ? action.skill.name : ""}?`,
    "add-suggestion": "Add as a skill",
    "merge-suggestion": "Merge into an existing skill",
    "reject-suggestion": "Reject this suggestion",
  }[action.kind];

  const needsName = action.kind === "create" || action.kind === "rename" || action.kind === "alias" || action.kind === "add-suggestion";
  const needsLevel = action.kind === "create" || action.kind === "add-suggestion";
  const needsReason = action.kind === "retire" || action.kind === "reject-suggestion";
  const ready =
    (!needsName || name.trim().length >= 2) &&
    (!needsLevel || !parentLevel || parentId !== "") &&
    (!needsReason || reasonOk) &&
    (action.kind !== "merge-suggestion" || targetId !== "");

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      destructive={action.kind === "retire" || action.kind === "reject-suggestion"}
      description={
        action.kind === "retire"
          ? "The skill disappears from the picker. This is blocked while any member has it or active skills sit under it."
          : undefined
      }
      className="max-w-md"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (ready) run.mutate();
        }}
      >
        {needsName && (
          <Field id="sk-name" label={action.kind === "alias" ? "Alias" : "Name"}>
            <input id="sk-name" className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
        )}
        {needsLevel && (
          <>
            <Field id="sk-level" label="Level">
              <select
                id="sk-level"
                className={inputClass}
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value as SkillLevel);
                  setParentId("");
                }}
              >
                {(["major", "minor", "micro"] as const).map((l) => (
                  <option key={l} value={l}>
                    {levelLabel(l)}
                  </option>
                ))}
              </select>
            </Field>
            {parentLevel && (
              <Field id="sk-parent" label={`Parent (${parentLevel})`}>
                <select id="sk-parent" className={inputClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">Choose…</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {pathLabel(taxonomy.skills, p.id)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        {action.kind === "merge-suggestion" && (
          <Field id="sk-target" label={`Treat "${action.suggestion.name}" as another name for`}>
            <select id="sk-target" className={inputClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose…</option>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {pathLabel(taxonomy.skills, s.id)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {needsReason && (
          <Field id="sk-reason" label={`Reason (at least ${AUDIT_REASON_MIN_LENGTH} characters, kept in the audit log)`}>
            <textarea id="sk-reason" rows={2} className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={needsReason ? "destructive" : "gradient"}
            disabled={!ready || run.isPending}
          >
            {run.isPending ? "Saving…" : needsReason ? "Confirm" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
