import { redirect } from "next/navigation";

// Server-only: SSR/Server Component calls go straight to the backend (Node-to-Node,
// no browser cookie jar involved — the caller must forward cookies explicitly).
// API_INTERNAL_URL is the bare backend origin (same value next.config.mjs's rewrite
// uses) — /api is appended here, not baked into the env var, so the two stay in sync.
const INTERNAL_API_URL = `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/api`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

export const MAINTENANCE_PATH = "/maintenance";

// The backend tags maintenance 503s with `maintenance: true` (MaintenanceGuard) —
// any API call that hits one sends the visitor to the maintenance page, from a
// Server Component (redirect) or the browser (full navigation) alike.
function isMaintenance(status: number, body: unknown) {
  return status === 503 && (body as { maintenance?: boolean } | null)?.maintenance === true;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (isMaintenance(res.status, body)) {
      if (typeof window === "undefined") redirect(MAINTENANCE_PATH);
      if (window.location.pathname !== MAINTENANCE_PATH) window.location.assign(MAINTENANCE_PATH);
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Used by Server Components/layouts — pass the incoming request's Cookie header
// explicitly (see shared/auth/session.ts), since Node's fetch has no browser
// cookie jar to draw from.
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { cookieHeader?: string } = {},
): Promise<T> {
  const { cookieHeader, ...init } = options;
  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...init.headers,
    },
    cache: init.cache ?? "no-store",
  });
  return handle<T>(res);
}

// Used by "use client" components — hits the same-origin /api/* path, which
// next.config.mjs rewrites to the backend, so the browser attributes the auth
// cookies to this app's own origin (see next.config.mjs comment) rather than the
// backend's cross-origin one.
export async function apiFetchClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  return handle<T>(res);
}
