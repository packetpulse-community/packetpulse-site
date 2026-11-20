import { ApiError, apiErrorFields } from "./http-client";

export interface ServerFormError {
  /** Field path -> first message, only for paths the form actually has. */
  fields: Record<string, string>;
  /** Message for the form-level (root) alert. Empty when every error was placed on a field. */
  root: string;
}

// Maps the backend's unified error body onto a form. `knownFields` are the form's
// field names; a backend path outside that set (or a nested path like
// "items.0.name" with no matching field) is not dropped silently - it goes to the
// root message so the person still sees why the request failed.
export function mapServerFormError(err: unknown, knownFields: readonly string[], fallback: string): ServerFormError {
  const known = new Set(knownFields);
  const fields: Record<string, string> = {};
  const unplaced: string[] = [];
  for (const f of apiErrorFields(err)) {
    // "profile.bio" -> try the full path first, then the leading segment.
    const name = known.has(f.path) ? f.path : (f.path.split(".")[0] ?? "");
    if (known.has(name)) fields[name] ??= f.message;
    else unplaced.push(f.message);
  }
  if (Object.keys(fields).length > 0 && unplaced.length === 0) return { fields, root: "" };
  const bodyMessage = err instanceof ApiError ? (err.body as { message?: string } | null)?.message : undefined;
  return { fields, root: unplaced[0] ?? bodyMessage ?? fallback };
}


// Applies the mapping with react-hook-form's setError: field errors inline (the
// first one takes focus so keyboard and screen-reader users land on it), anything
// else in the "root" alert.
export function applyServerFormError(setError: unknown, err: unknown, knownFields: readonly string[], fallback: string) {
  const set = setError as unknown as (name: string, error: { message: string }, options?: { shouldFocus?: boolean }) => void;
  const { fields, root } = mapServerFormError(err, knownFields, fallback);
  let first = true;
  for (const [name, message] of Object.entries(fields)) {
    set(name, { message }, { shouldFocus: first });
    first = false;
  }
  if (root) set("root", { message: root });
}
