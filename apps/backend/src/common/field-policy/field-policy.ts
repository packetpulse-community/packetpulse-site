import { FIELD_POLICY, FieldPolicyEntry, FieldPolicyViewer } from "@packetpulse/types";

// TASK-012: strips fields the viewer may not read. The table lives in
// @packetpulse/types (FIELD_POLICY); this file only applies it.

export interface ApplyFieldPolicyOptions {
  /** Policy table; defaults to the shared FIELD_POLICY. Tests and future modules may pass a longer one. */
  policy?: readonly FieldPolicyEntry[];
  /**
   * Relationships the viewer has to one particular object (beyond "self", which is derived
   * from `selfKey`). Called for every plain object visited, so a rule such as
   * "recruiter-forwarded" can look at the object's own id or stage.
   */
  relationshipsOf?: (obj: Record<string, unknown>, viewer: FieldPolicyViewer) => readonly string[];
  /** Property holding the owner's user id; an object with this value equal to the viewer is "self". */
  selfKey?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function canReadField(
  entry: FieldPolicyEntry,
  viewer: FieldPolicyViewer,
  relationships: readonly string[],
): boolean {
  const held = [...viewer.roles, ...relationships, ...(viewer.relationships ?? [])];
  if (entry.deny?.some((d) => held.includes(d))) return false;
  return (
    entry.roles.some((r) => viewer.roles.includes(r)) ||
    entry.relationships.some((r) => relationships.includes(r) || (viewer.relationships ?? []).includes(r))
  );
}

/**
 * Returns a copy of `data` (object, list, or any nesting of them) with every field the
 * viewer may not read removed. Dates and class instances are returned untouched; the input
 * is never mutated. Anonymous callers pass `{ roles: [] }`.
 */
export function applyFieldPolicy<T>(data: T, viewer: FieldPolicyViewer, options: ApplyFieldPolicyOptions = {}): T {
  const policy = options.policy ?? FIELD_POLICY;
  const byField = new Map(policy.map((e) => [e.field, e]));
  const selfKey = options.selfKey ?? "id";

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isPlainObject(value)) return value;
    const relationships: string[] = [...(options.relationshipsOf?.(value, viewer) ?? [])];
    if (viewer.userId && value[selfKey] === viewer.userId) relationships.push("self");
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const entry = byField.get(k);
      if (entry && !canReadField(entry, viewer, relationships)) continue;
      out[k] = walk(v);
    }
    return out;
  };

  return walk(data) as T;
}

/** The viewer for a request: `req.user` is the access-token payload, absent on anonymous routes. */
export function viewerFrom(user?: { sub: string; roles?: readonly string[] } | null): FieldPolicyViewer {
  return { userId: user?.sub, roles: user?.roles ?? [] };
}
