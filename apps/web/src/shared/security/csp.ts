// Content-Security-Policy builder (TASK-011). Pure and dependency-free so it can be unit
// tested and used from proxy.ts (which sets the header per request).
//
// CSP_MODE=report-only (default) | enforce picks the header NAME and, for enforce, adds
// the hardening directives. Nothing is blocked until the owner sets CSP_MODE=enforce.
// The nonce option is groundwork and is NOT wired into proxy.ts: a nonce only reaches
// dynamically rendered pages, and routes using generateStaticParams stay prerendered with no
// nonce, so their scripts would be blocked (verified in a build). See docs/ops/web-security.md.

export type CspMode = "report-only" | "enforce";

export interface CspOptions {
  mode: CspMode;
  production: boolean;
  /** Per-request nonce; when set, script-src uses it instead of 'unsafe-inline'. */
  nonce?: string;
  /** NEXT_PUBLIC_SUPABASE_URL (storage, realtime). */
  supabaseUrl?: string;
}

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function parseCspMode(value: string | undefined): CspMode {
  return value?.trim().toLowerCase() === "enforce" ? "enforce" : "report-only";
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function cspHeaderName(mode: CspMode): string {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

export function buildCsp({ mode, production, nonce, supabaseUrl }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase?.replace(/^http/, "ws");
  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", TURNSTILE_ORIGIN]
    : ["'self'", "'unsafe-inline'", TURNSTILE_ORIGIN];
  if (!production) scriptSrc.push("'unsafe-eval'"); // React dev tooling only; never in production

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Next/Tailwind and many components use inline styles; style injection is a much lower risk than script.
    "style-src 'self' 'unsafe-inline'",
    // Blog/resource/recording images are admin-supplied https URLs, so any https image host is allowed.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // The API and Socket.IO are same-origin through the /api and /socket.io rewrites.
    ["connect-src 'self'", TURNSTILE_ORIGIN, supabase, supabaseWs, production ? "" : "ws: http://localhost:*"]
      .filter(Boolean)
      .join(" "),
    // Turnstile challenge iframe; PDF previews load files from the Supabase storage origin.
    ["frame-src 'self'", TURNSTILE_ORIGIN, supabase].filter(Boolean).join(" "),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (mode === "enforce" && production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
