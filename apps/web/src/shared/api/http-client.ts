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

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
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
