import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INTERNAL_API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy, deliberately REPORT-ONLY for now (TASK-011). Why:
// - Next.js App Router emits inline bootstrap scripts, so script-src needs
//   'unsafe-inline' until a per-request nonce is wired through middleware; and
//   Tailwind/Next inject inline styles. That weakens script protection, which is
//   why this is the starting point, not the end state.
// - Enforcing a policy that has never been observed against real pages risks
//   blanking the site (embedded PDF previews, Supabase realtime/storage, the
//   Socket.IO websocket). Report-only logs violations in the browser console
//   without blocking anything, so we can tighten, then switch the header name to
//   Content-Security-Policy once a release passes with no violations.
// - There is no report-uri yet: the backend is outside this change. Violations are
//   visible in the browser console (and could later go to a report endpoint).
// frame-ancestors/base-uri/form-action/object-src below are the parts that are safe
// to enforce eventually without any nonce work.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ["connect-src 'self'", supabaseOrigin, supabaseWs, isDev ? "ws: http://localhost:*" : ""].filter(Boolean).join(" "),
  "frame-src 'self' https:", // resource PDF preview iframes (ResourcePreviewModal)
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // frame-ancestors in the CSP is the modern control; X-Frame-Options covers old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The network simulator is shipped as TypeScript source inside the workspace.
  transpilePackages: ["@packetpulse/netsim"],
  // Pin the tracing root to this monorepo — a sibling checkout with its own
  // lockfile at /home/hackycoder/mca_labs otherwise confuses Next's auto-detection.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // Proxies browser-originated /api/* calls to the backend so they're same-origin
    // from the browser's perspective — the backend's Set-Cookie for the httpOnly
    // auth cookies then lands on this app's own origin, which is what lets
    // Server Components' cookies() see them. Server-side (SSR) calls skip this
    // proxy entirely and hit the backend directly (see shared/api/http-client.ts).
    return [
      { source: "/api/:path*", destination: `${INTERNAL_API_URL}/api/:path*` },
      // Socket.IO's actual HTTP/WS transport endpoint is /socket.io/ (its own
      // namespace concept, e.g. "/ws", is layered on top and doesn't affect this
      // path) — proxied same-origin for the same cookie-domain reason as /api/*
      // above (shared/hooks/useRealtime.ts connects via a relative io("/ws") URL).
      // Engine.IO's server genuinely requires the trailing slash (verified: /socket.io
      // 404s, /socket.io/ 200s against the raw backend) — but Next normalizes away a
      // client request's trailing slash before rewrites run, so matching on
      // "/socket.io/:path*" alone lets the slash-less request fall through to a 404.
      // Both rules force it back on the *destination*, regardless of which one matched
      // (found by curling the proxy directly, not just eyeballing the config).
      { source: "/socket.io", destination: `${INTERNAL_API_URL}/socket.io/` },
      { source: "/socket.io/:path*", destination: `${INTERNAL_API_URL}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
