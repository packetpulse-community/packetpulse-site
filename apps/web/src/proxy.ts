import { NextResponse, type NextRequest } from "next/server";

// Pages that must never bounce through /refresh (they either don't need a session
// or are part of getting one).
const SKIP_PREFIXES = ["/refresh", "/login", "/register", "/forgot-password", "/verify-email", "/maintenance"];

// The access-token cookie expires after 15 minutes, but the refresh cookie (7 days)
// is scoped to /api/auth/refresh, so only the browser can use it — server-rendered
// pages never see it. When a signed-in visitor's access cookie has lapsed, send
// them through the tiny /refresh page, which renews the session client-side and
// returns them here — instead of the page rendering logged-out and pushing them
// back to the (rate-limited) login form every 15 minutes.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  const signedIn = request.cookies.has("session_active");
  const hasAccessToken = request.cookies.has("accessToken");
  if (!signedIn || hasAccessToken) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/refresh";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Page navigations only — not the /api proxy, Next internals, or static files.
  matcher: ["/((?!api|socket\\.io|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
