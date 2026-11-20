import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, cspHeaderName, parseCspMode } from "@/shared/security/csp";

// Pages that must never bounce through /refresh (they either don't need a session
// or are part of getting one).
const SKIP_PREFIXES = ["/refresh", "/login", "/register", "/forgot-password", "/verify-email", "/maintenance"];

// The access-token cookie expires after 15 minutes, but the refresh cookie (7 days)
// is scoped to /api/auth/refresh, so only the browser can use it — server-rendered
// pages never see it. When a signed-in visitor's access cookie has lapsed, send
// them through the tiny /refresh page, which renews the session client-side and
// returns them here — instead of the page rendering logged-out and pushing them
// back to the (rate-limited) login form every 15 minutes.
// Static marketing pages are prerendered and never read the session on the server, so
// bouncing a signed-in visitor through /refresh before showing them only adds a redirect, a
// page load and an API call (several seconds on a cold backend) for no benefit. The navbar
// shows the right state from the non-httpOnly presence cookie instead (shared/auth/session-hint).
// Pages that DO read the session on the server (blogs, resources, the app) still go through
// /refresh when the 15-minute access cookie has lapsed.
const STATIC_PUBLIC_PATHS = new Set(["/", "/about", "/contact", "/privacy", "/terms"]);
const STATIC_PUBLIC_PREFIXES = ["/tools"];

function isStaticPublic(pathname: string) {
  return (
    STATIC_PUBLIC_PATHS.has(pathname) ||
    STATIC_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

// Layouts cannot see the URL they render for, but they must know it to send a
// signed-out visitor to /login?next=<path> (deep links survive sign-in). Forward it
// as a request header — set here for EVERY page request, overwriting anything the
// client sent, so it cannot be spoofed. See shared/auth/redirect-to-login.ts.
const PATH_HEADER = "x-pp-path";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname + search);

  // Content-Security-Policy (TASK-011): header name and strictness follow CSP_MODE (default
  // report-only). Scripts use 'unsafe-inline' because Next's inline bootstrap needs it and a
  // nonce cannot reach prerendered pages; see docs/ops/web-security.md.
  const mode = parseCspMode(process.env.CSP_MODE);
  const csp = buildCsp({
    mode,
    production: process.env.NODE_ENV === "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const pass = () => {
    const res = NextResponse.next({ request: { headers } });
    res.headers.set(cspHeaderName(mode), csp);
    return res;
  };

  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return pass();
  if (isStaticPublic(pathname)) return pass();

  const signedIn = request.cookies.has("session_active");
  const hasAccessToken = request.cookies.has("accessToken");
  if (!signedIn || hasAccessToken) return pass();

  const url = request.nextUrl.clone();
  url.pathname = "/refresh";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Page navigations only — not the /api proxy, Next internals, or static files.
  matcher: ["/((?!api|socket\\.io|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
