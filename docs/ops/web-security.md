# Web security hardening notes

Document 4 TASK-011 (TEST-011). Covers response headers, the request-forgery (CSRF) assessment and scanning.

## Response headers (`apps/web/next.config.mjs`, `headers()`; CSP in `apps/web/src/proxy.ts`)

| Header | Value | Why |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Stops browsers guessing a type for uploaded or proxied content. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Do not leak full URLs (which may carry tokens such as verify-email links) to other sites. |
| `Permissions-Policy` | camera, microphone, geolocation, payment, usb all off | The site uses none of these; denying them limits what injected script could do. |
| `X-Frame-Options` | `DENY` | Clickjacking protection for old browsers. |
| `Strict-Transport-Security` | 2 years, includeSubDomains | HTTPS only. Vercel serves HTTPS; no `preload` until the owner is sure every subdomain is HTTPS. |
| `Content-Security-Policy-Report-Only` (default) or `Content-Security-Policy` | built by `apps/web/src/shared/security/csp.ts`, set per request in `proxy.ts`; see below | Name and strictness follow `CSP_MODE`. |

The backend already sets `helmet()` defaults on API responses.

### Content-Security-Policy and `CSP_MODE`

`CSP_MODE` (server env var, read at request time) is `report-only` (default; anything else also means report-only) or `enforce`. Until the owner sets `enforce`, nothing is blocked.

Directives (both modes): `default-src 'self'`; `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` (`'unsafe-eval'` only outside production); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https:`; `font-src 'self' data:`; `connect-src 'self'` + Turnstile + the Supabase origin and its `wss://` from `NEXT_PUBLIC_SUPABASE_URL`; `frame-src 'self'` + Turnstile + the Supabase origin; `worker-src 'self' blob:`; `manifest-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'`. `enforce` in production additionally sends `upgrade-insecure-requests`. The API and Socket.IO are same-origin through the `/api` and `/socket.io` rewrites, so no API origin is listed. Fonts are self-hosted/system, so no font CDN is needed. A unit test (`csp.test.ts`) pins these, and that production never contains `unsafe-eval`.

Known remaining weakness: `script-src` still has `'unsafe-inline'` (Next's inline bootstrap). A nonce was tried in a throwaway build: it put nonces on dynamically rendered pages, but pages prerendered with `generateStaticParams` (`/tools/packet-lab/*`) get no nonce, so their scripts would be blocked, and forcing everything dynamic costs the static marketing pages. `buildCsp` supports a `nonce` option, but `proxy.ts` does not use it. Revisit with Next's PPR/SRI-based strict CSP before relying on script protection from this policy.

### Rollout

1. Deploy with `CSP_MODE` unset (or `report-only`). The header is `Content-Security-Policy-Report-Only`; behaviour is unchanged.
2. For about a week, browse the main flows on the real deployment with DevTools open (home, login/register with Turnstile on, dashboard, blogs, resources with a PDF preview, certificates, Packet Lab, admin) and check the console for "violates the following Content Security Policy directive". There is no report endpoint yet, so this is manual.
3. Fix real violations in code, or add an origin only if it is genuinely needed.
4. Set `CSP_MODE=enforce` in the Vercel project env (Production) and redeploy. Re-run the same click-through immediately.
5. **Rollback:** set `CSP_MODE=report-only` (or delete it) and redeploy. No code change is needed.

### What the browser run verified, and what it could not

Verified on a production build (`next start`) with `CSP_MODE=enforce`, local web only, no backend: `/`, `/login`, `/register`, `/tools/packet-lab`, `/tools/packet-lab/ping-lan` (hydrates, Play works, `securitypolicyviolation` events: none), `/blogs`, `/certificates`, `/design-system`, `/dashboard` (the last four redirect to login without a backend). No CSP violations other than my own test iframe being refused by `frame-ancestors 'none'` (expected). `upgrade-insecure-requests` did not break `http://localhost`.

Not verified: signed-in pages and the admin area (no backend); the Turnstile widget (no site key set, so its script/iframe/connect allowances are from Cloudflare's documented needs, not observed); PDF preview iframes and Supabase storage/realtime (no Supabase run); images from arbitrary https hosts (allowed by `img-src https:` for that reason); the Vercel preview/production deployment, including whether Vercel's own toolbar scripts in preview deployments are blocked.

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
