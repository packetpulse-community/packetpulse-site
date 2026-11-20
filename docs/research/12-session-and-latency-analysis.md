# 12. Session and Latency Analysis

Part of the [research pack](00-index.md). Written 20 Nov 2026 after a report that (1) a signed-in person on the public **Tools** page still saw "Sign In", and clicking it went straight to their session, and (2) APIs respond late, so the session seems to load late. Everything marked **measured** was measured from the development machine on that day; everything marked **not measured** is a hypothesis to confirm.

## 1. Summary

| # | Finding | Effect | Status |
| --- | --- | --- | --- |
| F1 | The public navbar was static, so every public page always showed Sign In and Sign Up | The signed-in problem you saw, on home, about, contact, blogs, tools, privacy, terms and certificate verify | **Fixed** (`9abcc0f`) |
| F2 | `proxy.ts` sent signed-in visitors through `/refresh` even for static public pages | A redirect, a page load and an API call before the page appeared, once the 15-minute access cookie lapsed | **Fixed** for static pages (`b118a86`) |
| F3 | `/auth/me` made 6 sequential database round trips | Every protected page load waited on 6 trips to a database in Tokyo | **Fixed**: now 2 (`93ffa61`) |
| F4 | On the development machine every DNS lookup takes **5.05 s** (a glibc resolver quirk) | Local dev with a remote database was 5 to 9 s slower than anything deployed | **Workaround**: `RES_OPTIONS=single-request-reopen` |
| F5 | Hosting layout: backend on Render in Singapore, database in Supabase Tokyo, backend on a free plan | Distance on every query; cold starts after idle | **Needs your decision** (section 5) |

## 2. Why the navbar showed Sign In (F1)

The public pages are prerendered, so the server cannot read the session for them, and the `Navbar` component had no auth logic at all. The backend already sets a non-httpOnly cookie `session_active` "so the frontend can cheaply show logged-in UI state", but nothing read it. Clicking Sign In went to `/login`, and the app then put the person into their existing session, which is what you saw.

Fix: `useSessionHint()` reads that cookie in the browser. Signed-in visitors see a **Dashboard** button, signed-out visitors see Sign In and Sign Up, and for the first paint a same-size placeholder is shown so the page never claims the wrong state. The cookie is a UI hint only; access is still enforced by the server. Still to do: the hero, footer and final call-to-action blocks still show Join and Sign In links to signed-in visitors.

## 3. Why the session loads late

### 3.1 The path of a protected page

```
Browser ─▶ Vercel (SSR) ─▶ Render backend ─▶ Supabase (Tokyo)
              │               ├─ ApprovedGuard: 1 query
              │               └─ /auth/me: user lookup (was 5 queries, now 1)
              └─ then the page's own API calls
```

When the 15-minute access cookie has lapsed, the visitor first bounces `/page` → `/refresh` (a client page) → `POST /api/auth/refresh` (rotates the token: several queries) → back to `/page` → `/auth/me` again. Each hop adds a full round trip.

### 3.2 Measured against the deployed site (IPv4 forced, warm, 5 runs each)

| Request | Time to first byte | What it shows |
| --- | --- | --- |
| `/tools` (static page, Vercel) | 0.17 to 0.24 s | The web layer is fast |
| `/login` | 0.29 to 0.34 s | The same |
| `/api/auth/me` with no session (401, no database work) | 0.41 s | **The network floor for any API call is about 0.4 s** (Vercel to Render and back) |
| `/api/categories` (one query) | 0.55 to 0.65 s | One database round trip adds about 0.15 to 0.25 s |
| `/api/blogs` (list) | about 1.0 s | Several queries add up |

So a signed-in `/auth/me` that used to make 6 round trips cost roughly 0.4 s plus 6 round trips, easily 1.2 to 2 s before the page could start, and the page's own API calls came after that. Reducing it to 2 trips removes the largest avoidable part (about 4 trips).

### 3.3 The development-machine stall (F4)

Every name lookup on the development machine took exactly **5.05 s** (`getent ahosts`), and Node's `dns.lookup` took 5.09 s. All four configured DNS servers answer in under 0.4 s on their own, so it is the glibc resolver's behaviour: it sends the A and AAAA queries in parallel, something on the network drops one reply, and it waits out the 5 s timeout. With `RES_OPTIONS=single-request-reopen` the lookup takes 0.05 s. Prisma, `pg`, `fetch` and Next all resolve through `getaddrinfo`, so local dev against the remote database paid 5 s on every new connection. Earlier dev runs showed it as `/blogs` taking 8.6 s. **This does not affect the deployed site**; it is why local was far slower than production.

## 4. What changed

| Commit | Change |
| --- | --- |
| `9abcc0f` | Navbar session hint and Dashboard button, with unit tests |
| `b118a86` | `proxy.ts` no longer bounces signed-in visitors on `/`, `/about`, `/contact`, `/privacy`, `/terms`, `/tools` |
| `93ffa61` | `relationJoins` enabled; `findById` and `findByEmail` load user, roles and permissions in 1 query (5 before). Whole e2e suite (137) passes; note every nested include now defaults to a join |

## 5. Still open, ranked by likely impact (not measured, for you to decide)

| Rank | Option | Why | Owner decision |
| --- | --- | --- | --- |
| 1 | **Keep the Render backend warm or move off the free plan** | Render's free instances sleep after about 15 minutes idle; the first request can take 30 to 60 s. An earlier commit (`2e836ed`) already raised a health-check timeout for this. I could not observe a cold start, because the backend was warm during my tests | Pay for an instance, or ping `/api/health` every 5 to 10 minutes (TASK-005 uptime check) |
| 2 | **Put the database in the same region as the backend** | The connection host indicates Supabase **Tokyo** while the backend is in **Singapore**; every query pays that distance. Render has no Tokyo region, so the practical move is a Supabase project in Singapore | Create a new project and migrate the data (a planned change, not an edit) |
| 3 | **Refresh the session before it lapses** | After 15 minutes the next protected page costs a redirect plus a refresh call. An open tab could renew quietly before expiry | Small web change; I can add it |
| 4 | **Cache the approval check** | `ApprovedGuard` queries the database on every request. A short Redis cache invalidated on approval changes would remove one trip per request | Trade-off: complexity against about 0.15 s |
| 5 | **Measure for real** | Add a `Server-Timing` header (database time, total) so the browser's network panel shows where each request spends time | Small backend change; I can add it |

## 6. Developer fix for the 5-second local stall

Add this to your shell profile, then restart your terminals and dev servers:

```bash
export RES_OPTIONS=single-request-reopen
```

To check: `time getent ahosts example.com` should take well under a second instead of about 5. A system-wide fix (adding `options single-request-reopen` to the resolver configuration, for example through NetworkManager) also works but changes machine settings, so it is left to you.

## 7. How these numbers were produced

```bash
# deployed latency (IPv4 forced to avoid the local DNS stall)
curl -4 -s -o /dev/null -w "%{http_code}:%{time_starttransfer}\n" https://test.packetpulse.in/api/health
# DNS stall
time getent ahosts test.packetpulse.in
RES_OPTIONS=single-request-reopen sh -c 'time getent ahosts test.packetpulse.in'
# queries per user lookup: run the Prisma query log against the local database
```

## 8. Not verified

Render cold-start time (backend was warm); real latency from a browser in India (measurements were from one machine); the effect of the changes on production (to be checked on the next deploy); whether the test domain's backend is the same service as production.
