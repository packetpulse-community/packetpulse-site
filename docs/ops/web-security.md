# Web security hardening notes

Document 4 TASK-011 (TEST-011). Covers response headers, the request-forgery (CSRF) assessment and scanning.

## Response headers (`apps/web/next.config.mjs`, `headers()`)

| Header | Value | Why |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Stops browsers guessing a type for uploaded or proxied content. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Do not leak full URLs (which may carry tokens such as verify-email links) to other sites. |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb all off | The site uses none of these; denying them limits what injected script could do. |
| `X-Frame-Options` | `DENY` | Clickjacking protection for old browsers. |
| `Strict-Transport-Security` | 2 years, includeSubDomains | HTTPS only. Vercel serves HTTPS; no `preload` until the owner is sure every subdomain is HTTPS. |
| `Content-Security-Policy-Report-Only` | see below | Observe before enforcing. |

The backend already sets `helmet()` defaults on API responses.

### Why the CSP is report-only

Next.js App Router injects inline bootstrap scripts, so a strict `script-src 'self'` would break every page unless a per-request nonce is added through middleware (a larger change touching `apps/web/src`, out of scope here). `'unsafe-inline'` weakens script protection, so this policy is a **starting point**: it already forbids framing, `<object>`, foreign `<base>` and foreign form targets, and limits connections to self plus the Supabase origin. Enforcing it blind could blank pages (PDF preview iframes, Supabase realtime, the Socket.IO websocket), so violations are only reported in the browser console for now. There is no report endpoint yet.

Path to enforcement: (1) browse the main flows in production with the console open and collect violations; (2) add nonce support and drop `'unsafe-inline'` from `script-src`; (3) rename the header to `Content-Security-Policy`; (4) optionally add a report endpoint.

## Request-forgery (CSRF) assessment

Facts from the code:

- Auth cookies are `httpOnly` and `sameSite: "lax"` (`identity/application/services/auth-cookie.service.ts`).
- Browser calls are same-origin through the `/api/*` rewrite, so the cookies belong to the web origin.
- CORS is an explicit allowlist with `credentials: true`, never `*`.
- Bearer token is also accepted by the JWT strategy.

Assessment: with `SameSite=Lax` browsers do not send the cookie on cross-site POST, PUT, PATCH or DELETE requests, so classic CSRF against state-changing JSON endpoints is largely blocked. Remaining exposure:

1. **State-changing GET endpoints**: Lax cookies are sent on cross-site top-level GET navigations. Any GET that changes state is forgeable. Not yet audited endpoint by endpoint; action: review controllers for GETs with side effects (backend modules are owned by other work, so this is a finding for them).
2. **Same-site, cross-origin attackers** (a compromised or user-content subdomain of the same registrable domain): Lax does not protect against these.
3. **Old browsers** without SameSite support.

Recommended hardening, not yet done: reject mutating requests whose `Origin`/`Referer` is not in `CORS_ORIGINS` (a small middleware in `main.ts`), and keep requiring `Content-Type: application/json` on mutations. A CSRF token is not needed while the two controls above hold. Verdict: **low risk today, with the GET audit and the Origin check as follow-ups.**

## Scanning (CI)

- `pnpm audit --prod --audit-level=high` on every run (see `.github/workflows/ci.yml` for whether it is blocking or report-only and why).
- gitleaks secret scan on every pull request and push to `main`.
- Enable GitHub Dependabot alerts and secret scanning push protection in the repository settings (not configurable from the repo files here).
