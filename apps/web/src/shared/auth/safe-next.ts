// "Deep links survive sign-in": a signed-out visitor who opens a protected URL is
// sent to /login?next=<path> and returned there afterwards. The value comes from
// the query string, so it is attacker-controlled: ONLY same-site paths are
// accepted, never an absolute or protocol-relative URL (open-redirect defence).

export const DEFAULT_AFTER_LOGIN = "/dashboard";

// Pages that are part of getting a session; returning to them after sign-in would loop.
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/refresh"];

/** Returns the path when it is a safe same-site path, otherwise null. */
export function sanitizeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;

  let value = raw;
  // The browser strips tabs/newlines inside URLs, and treats "\" like "/" — so
  // "/\evil.com" or "/\t/evil.com" would become "//evil.com". Reject them outright.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  // Defence in depth: resolve against a throwaway origin and make sure it stays there.
  try {
    const base = "http://pp.invalid";
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return null;
    value = resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return null;
  }

  const pathname = value.split(/[?#]/)[0] ?? "";
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null;
  return value;
}

/** Safe path or the fallback (dashboard). */
export function safeNext(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  return sanitizeNextPath(raw) ?? fallback;
}

/** The sign-in URL that returns to `path` afterwards (plain /login when the path is not safe). */
export function loginUrlFor(path: string | null | undefined): string {
  const next = sanitizeNextPath(path);
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
