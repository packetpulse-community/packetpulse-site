# Bot protection and client-IP trust (TASK-013, finding S-11)

Two independent settings. Both are **off / unchanged by default**, so nothing changes in production until the owner sets them.

## 1. Cloudflare Turnstile captcha

Protects `POST /api/auth/register`, `login`, `forgotpassword` and `verifyotp`. It does not apply to refresh, reset-password, verify-email or any signed-in route.

| Where | Variable | Meaning |
| --- | --- | --- |
| Backend (Render) | `TURNSTILE_SECRET_KEY` | Unset or blank = captcha disabled. Set = every protected request must carry a valid token. |
| Web (Vercel) | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Unset = the widget never renders and Cloudflare's script is never loaded; the forms behave as before. |

### Turning it on
1. Cloudflare dashboard -> Turnstile -> Add site. Add the production hostname (and the Vercel preview hostnames if wanted). Widget mode "Managed". Copy the **site key** and **secret key**.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` on Vercel (it is baked in at build time, so redeploy) **and** `TURNSTILE_SECRET_KEY` on Render. Set both: the secret without the site key locks everyone out of sign-in; the site key without the secret is harmless but pointless.
3. Allow Cloudflare in the CSP. `apps/web/next.config.mjs` currently sends a **report-only** CSP. Before that CSP is enforced, add `https://challenges.cloudflare.com` to `script-src`, `frame-src` and `connect-src`, or the widget will be blocked.
4. Check: open /login in a private window; the widget appears and Sign in is enabled once it completes.

### Behaviour
- Failure: HTTP 400, code `BAD_REQUEST`, message "We could not confirm you are human. Please try again."
- Turnstile unreachable (timeout 5 s, network error or non-2xx): fails **closed** - sign-in is refused. The backend log line is `Turnstile siteverify UNREACHABLE ... failing closed` (an `ERROR`); search for that when users report the message and Cloudflare is down. Rejected tokens log a `WARN` with Cloudflare's error codes. Tokens are never logged.
- In production with the secret unset, one warning is logged at boot.
- Tokens are single use; the form fetches a fresh one after every failed attempt.
- Tests replace `CaptchaService` with a fake (`test/captcha.e2e-spec.ts`); nothing in the suite calls Cloudflare. Cloudflare publishes always-pass/always-fail test keys if you want a manual check in a preview.

## 2. TRUST_PROXY (spoofable client IP, S-11)

Rate limits are per client IP. Express only uses `X-Forwarded-For` for `req.ip` when `trust proxy` is set. With the current default (`true`, trust everything) anyone who reaches the backend directly can send their own `X-Forwarded-For` and get a fresh rate-limit bucket on every request. The backend logs a warning at boot in production while the value is `true`.

`TRUST_PROXY` accepts:
- `true` (default when unset) - trust every hop. Spoofable.
- `false` - trust nothing; `req.ip` is the socket address (the proxy's, so all visitors would share one limit behind Render - do not use).
- an integer, e.g. `2` - trust that many proxies counted from the backend; `req.ip` is the address that many entries from the right of the chain.
- a comma-separated list of IPs / CIDRs (or `loopback`, `linklocal`, `uniquelocal`) - trust only those proxies.

An invalid value stops the boot with a clear error.

### Measuring the right hop count on Render behind Vercel
Traffic reaches the backend two ways: browsers through the Vercel `/api` rewrite, and Vercel servers (SSR) directly. Render's load balancer is always the last hop. Do not guess; measure:

1. Temporarily log the raw header on a throwaway deploy or a local reverse-proxy run, e.g. from a shell on the Render instance or with a one-line debug route, `req.headers["x-forwarded-for"]` and `req.socket.remoteAddress`. (Remove it afterwards.)
2. Send a request through each real path from a device whose public IP you know (`curl https://api.ipify.org`):
   - Browser path: `https://<vercel-site>/api/...`
   - Server path: the SSR call (or `curl` the Render URL directly for the direct path).
3. Read the chain `X-Forwarded-For: a, b, c`. Count entries from the right, starting at the first entry that is **your** IP. Every entry to the right of your IP is infrastructure (Vercel edge, Render LB). `TRUST_PROXY` = the number of those infrastructure hops, so that `req.ip` resolves to your IP.
   - Example: if the chain is `<your ip>, <vercel ip>` and Render's LB appends itself only as the socket peer, then there are 2 trusted proxies (Vercel, Render LB) -> `TRUST_PROXY=2`.
4. The two paths may differ by one hop (a direct SSR call skips the browser-side edge). If they differ, prefer the smaller count that still yields the visitor's IP for the browser path, or use the CIDR list form with the published Vercel and Render ranges. Verify with the check below.
5. Set `TRUST_PROXY=<n>` on Render and redeploy. **This guide does not choose the value; the owner sets it after measuring.**

### Check after setting it
- Log in from two different networks; `login` sessions (Settings -> sessions) should show each one's real IP.
- A request with a forged header, e.g. `curl -H "X-Forwarded-For: 1.2.3.4" https://<vercel-site>/api/...`, must not show `1.2.3.4`.
- If every visitor suddenly shares one rate limit (users locked out together), the count is too small; if forged headers are accepted, it is too large.

## What remains for the owner
- Create the Turnstile site and set both keys (section 1), then enforce the CSP with Cloudflare allowed.
- Measure and set `TRUST_PROXY` on Render (section 2).
