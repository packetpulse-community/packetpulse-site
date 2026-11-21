# Accessibility checks (TASK-050)

Target: **WCAG 2.2 AA in both themes** (Document 2 section 13, PRD-049). This page says what is checked
automatically, how to run it, what the last run found, what automation cannot catch, and what a person
must test by hand. The automated part is the first half of TASK-050; the screen-reader and device pass
(the checklist at the end) is still open and needs a human.

## What is scanned

There are two layers, both built on [axe-core](https://github.com/dequelabs/axe-core) 4.14.0 with the rule
sets `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`.

| Layer | Where | Runs | What it covers |
| --- | --- | --- | --- |
| Component scan | `apps/web/src/shared/ui/primitives/a11y.test.tsx`, `apps/web/src/shared/components/a11y.test.tsx` (helper: `apps/web/src/test/axe.ts`) | In the normal web unit test run, so **CI fails on a regression** | Every shared primitive (Button, Alert, Badge, StatusChip, Card, EmptyState, ErrorState, Skeleton, Table, DataTable, Select open and closed, Accordion, Tooltip, Dialog) and the shell (skip link, status screens, landing Navbar with the mobile menu open, Footer, sidebar navigation, breadcrumbs, theme switch, command palette). Also asserts behaviour: dialog is labelled and modal, focus moves in and returns, Escape closes, the command palette traps Tab and hands focus back |
| Route scan | `apps/web/scripts/a11y-scan.mjs` | On demand (not in CI: it needs a running app and a browser) | Every public page, the six auth/status screens, and every signed-in member and admin screen, in **Light and Dark**, at **1280 px and 375 px**, in a real Chromium. This is the layer that measures colour contrast, target size and layout |

The component scan runs in jsdom, which has no layout or stylesheets, so it **cannot check colour contrast
or target size**. Token contrast is covered separately by `grove-contrast.test.ts` and
`packet-lab-contrast.test.ts`, and everything rendered is covered by the route scan.

## How to run

Component scan (also part of `pnpm --filter @packetpulse/web test`):

```bash
pnpm --filter @packetpulse/web exec vitest run src/shared/ui/primitives/a11y.test.tsx src/shared/components/a11y.test.tsx
```

Route scan. Use a **local** backend only (see `environments.md`), never the shared or remote database, and
local test accounts only. Start the backend with the connection settings given explicitly (never from
`apps/backend/.env`, which points at the remote database):

```bash
# 1. Local services (Postgres on 5433, Redis on 6380), then the backend on its own port
DATABASE_URL=postgresql://packetpulse:packetpulse@localhost:5433/packetpulse \
REDIS_URL=redis://localhost:6380 PLATFORM_MODE=docker NODE_ENV=development PORT=4100 \
  node apps/backend/dist/main.js   # plus the JWT secrets and ADMIN_SECURE_CODE the backend requires

# 2. The web app against that backend, in docker mode so it does not talk to Supabase
API_INTERNAL_URL=http://localhost:4100 NEXT_PUBLIC_PLATFORM_MODE=docker \
  pnpm --filter @packetpulse/web exec next start -p 3100     # after a `next build`, or `next dev -p 3100`

# 3. Scan
node apps/web/scripts/a11y-scan.mjs --base http://localhost:3100 --set public
A11Y_EMAIL=<local member> A11Y_PASSWORD=<its password> node apps/web/scripts/a11y-scan.mjs --set member
A11Y_EMAIL=<local admin>  A11Y_PASSWORD=<its password> node apps/web/scripts/a11y-scan.mjs --set admin
```

Useful options: `--themes light,dark`, `--widths 1280,375`, `--only /path,/other` (just those pages),
`--extra /blogs/some-slug` (detail pages that need data), `--reduced-motion` (emulates the setting and
reports animations still running), `--out result.json` (every violating node with its selector).
The exit code is non-zero when anything is found. Credentials come only from the environment and are never
stored. The script uses the Chromium that Playwright has cached (`~/.cache/ms-playwright`) or the path in
`PLAYWRIGHT_CHROMIUM`; `playwright-core` is a dev dependency, no browser download happens in CI.

## Results

Last full run: 2026-11-21, axe-core 4.14.0, Chromium from the Playwright cache, local backend and a local
database with throwaway test accounts (a member-role and a super-admin account, removed afterwards). Counts
are **violating elements**; one run is one page in one theme at one width.

| Set | Runs | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Public pages (15 routes incl. auth, maintenance, 404, design system, Packet Lab) | 60 (Light, Dark, 1280, 375) | 320 | **0** | Skip link had no target, auth/maintenance had no `main`, dark-mode error text 2.4:1, Packet Lab names and dimmed rows, unnamed selects, links told apart by colour only |
| Member screens (11 routes) | 44 | 22 (first probe, Light 1280 only) | **0** | Unnamed filters and quiz-builder fields, heading order, redundant logo text, link without underline |
| Admin screens (15 routes) | 60 | 80 | **0** | Settings labels not tied to inputs, API docs selects, tables and log data that scroll sideways were not keyboard reachable, duplicate landmark names |
| Reduced-motion spot check (home, Packet Lab, dashboard, admin, quizzes) | 20 | not measured | 0 findings, 0 running animations | `--reduced-motion` |
| Component scan (primitives and shell) | 17 tests | 7 findings, plus a command palette with no dialog semantics | **0**, all in CI | DataTable page buttons had no names, `AlertTitle` was an `h5`, Footer titles skipped a level, Navbar search had no label |

Main fixes, all without changing behaviour: a `main id="main"` on every page (skip link now works and
landmarks are complete); `text-destructive` now uses the state-danger token, because the old fill colour
was only 2.4:1 as text in Dark (this affected every error message in Dark); accessible names for every
filter, search box, select and quiz-builder field; label-in-name for Packet Lab devices; the command
palette is a labelled modal dialog that contains Tab and returns focus; `CardTitle` is an `h2` by default;
a new `ScrollRegion` primitive makes sideways-scrolling content keyboard reachable only when it overflows.
Already fine and verified: toasts use sonner's polite live region, reduced motion is honoured, the shared
`Dialog` traps focus and returns it, 375 px never scrolls the page sideways (the scan reports it).

**Not scanned (gaps to know about):**

- Pages that need data the local database does not have: `/blogs/[slug]`, `/forums/[id]`,
  `/quizzes/[id]` (and attempt, edit), `/recordings/[id]`, `/resources/[id]`, `/admin/quizzes/[id]/edit`,
  `/certificates/verify/[number]`. Run them with `--extra` once a local record exists.
- States that need interaction: open dialogs and menus on real pages, toasts, form validation errors,
  Packet Lab after a scenario has been run, the quiz timer. The component tests cover the shared dialog and
  the palette; the page-level states need the manual pass.
- Pages being changed by other work at the time (profile, privacy centre, consent, onboarding, feature
  switches) were scanned only as they stood and need a re-run after they land. `ConsentCentre.tsx` has a
  sideways-scrolling table that should use `ScrollRegion` (left alone: not in this task's files).
- 320 px width and 200 % zoom (only 375 px is scanned).
- The scan ran against `next dev`, not a production build (a type error from other in-flight work blocked
  `next build` at the time); markup is the same, but re-run against `next start` before release.


## What automation cannot catch

axe finds roughly a third of WCAG problems. These need a person:

- **Whether the words make sense.** An accessible name can exist and still be useless ("Click here", a
  chart title that does not say what the chart shows, an error that does not say how to fix it).
- **Reading and focus order that is logical** rather than merely valid, and whether focus lands somewhere
  sensible after a route change, a dialog closing, a toast or an inline error.
- **Whether a screen reader announces the right thing at the right time**: live regions (toasts, form
  errors, quiz timers, Packet Lab narration), what is read for a table, a chart or the network diagram.
- **Keyboard operability of custom widgets** beyond "it has a role": arrow-key behaviour in the command
  palette, the select, accordion, tabs and the diagram, and that there is no trap anywhere.
- **Colour contrast over images, gradients and the marketing background**, and in states axe never sees
  (hover, focus, disabled, error, open menus). Focus rings need a visual check in both themes.
- **Zoom and reflow** at 200 % and 320 px, text spacing overrides, and content that only appears on
  interaction. The scan checks 375 px and flags sideways page scroll, not 320 px.
- **Motion and timing**: reduced-motion behaviour of every animation, auto-updating content, session and quiz
  time limits (WCAG 2.2.1).
- **Screens that need data the local database does not have** (see "Not scanned" above).
- **Touch ergonomics** on a real phone (target spacing, gesture alternatives, on-screen keyboard covering a
  field).
- **Cognitive load**: plain language, consistent help, error prevention on destructive actions.

## Manual screen-reader and device checklist (owner)

TEST-036 and TEST-037 ask for a real assistive-technology pass on the key journeys each release, with
notes kept. Do each journey with the pairs below and record what you find in a table like this (one row per
journey per tool; copy it into the release notes):

| Date | Build | Tool + browser + OS | Journey | Pass / fail | What happened | Issue link |
| --- | --- | --- | --- | --- | --- | --- |

**Tools to use (at least one per row):**

- Windows: **NVDA** (free) with Firefox or Chrome. Browse mode and focus mode both matter: `Insert+Space`
  toggles, `H` jumps by heading, `D` by landmark, `F` by form field, `K` by link, `T` by table, `Insert+F7`
  lists links, headings and landmarks.
- macOS: **VoiceOver** with Safari. `Cmd+F5` starts it; `VO` is `Ctrl+Option`; `VO+U` opens the rotor
  (headings, links, form controls, landmarks); `VO+Right` moves through content.
- iPhone: **VoiceOver** with Safari. Settings, Accessibility, VoiceOver. Swipe right/left to move, double
  tap to activate, rotor by twisting two fingers.
- Android: **TalkBack** with Chrome. Settings, Accessibility, TalkBack. Swipe right/left to move, double
  tap to activate, swipe up-then-right for the local context menu (headings, links, controls).

Before each journey also do the **keyboard-only pass** (no mouse, no screen reader): Tab and Shift+Tab reach
everything in a logical order, focus is always visible (in Light and in Dark), Enter and Space operate
buttons, Escape closes dialogs and the command palette (`Ctrl+K`), and focus never gets stuck.

**What to listen and look for on every screen:** one page title and one H1; the heading list reads like an
outline; landmarks (banner, navigation, main, footer) are announced; every control is announced with a
sensible name, role and state (for example "Theme, Light, radio button, 1 of 3, checked"); icon-only buttons
say what they do; links make sense out of context (the links list has no run of "Read more"); images that
matter have a description and decorative ones are silent; form errors are announced when they appear and are
reachable from the field; toasts are announced without stealing focus; loading and empty states are
announced; nothing announces twice.

The six journeys, with the steps to run and the specific things to confirm:

1. **Sign up and onboarding** (`/register`, then verify email, then first visit to the dashboard)
   - Open `/register` from the landing page "Sign up". The page title and H1 are announced; the skip link
     appears on first Tab.
   - Fill every field using only the keyboard. Each field announces its label, whether it is required and its
     help text (the password requirements are announced, not just shown). Submit with an empty form and with
     a weak password: the errors are announced, focus moves to the first error, and each error is tied to its
     field.
   - Tick the terms/consent controls; each one announces what it consents to and whether it is required.
   - Complete the verification step and land on the dashboard: the new page's heading is announced, and the
     "verify your email" banner (if shown) is reachable and dismissible.
2. **Sign in, sign out and password reset** (`/login`, `/forgot-password`)
   - Sign in with a wrong password: the error is announced. With the right one: focus goes to the new
     page, the user's name and role are announced in the sidebar or top bar.
   - Run the forgot-password flow (request, code, new password). Each step announces its heading and
     any error. Sign out and confirm you arrive on a page that says so.
3. **Take a quiz (assessment)** (`/quizzes`, open one, start an attempt, submit)
   - The list announces each quiz as a link with a clear name. Inside an attempt, each question is a
     fieldset with a legend; options are radio buttons or checkboxes with their text; the current question
     number and the total are available.
   - If there is a timer: it can be reached, it is not read out every second, a low-time warning is
     announced once, and the time-limit behaviour is explained before starting (WCAG 2.2.1).
   - Submit with questions unanswered (the warning is announced), then finish: the score and result are
     announced, and a certificate link, if any, has a distinct name.
4. **Verify a certificate** (`/certificates/verify/<number>`, from a certificate you hold or a number you
   type in)
   - The page is reachable without signing in. The result (valid or not found) is announced and does not
     depend on colour alone: a text label and an icon are present. The holder, course and date are read in
     a sensible order. The not-found state offers a next step.
5. **Browse and use content as a member** (`/resources`, `/forums`, `/blogs`, notifications)
   - Search and filter using the keyboard: each filter announces its name; results update with an announced
     count or a clear change. Open an item, post a forum reply or like a blog post: the toast or inline
     confirmation is announced without moving focus. Open the notification bell and the notifications page.
   - Open and cancel a destructive action (for example deleting an item you own): focus moves into the
     dialog, Escape cancels, focus returns to the button you used.
6. **Packet Lab** (`/tools/packet-lab`)
   - Start from the heading; reach the scenario list, then the controls (play, step, speed, capture
     filter). Each control announces its name and state. Select a device in the diagram with Enter or Space:
     the device name and addresses are announced and the inspector updates.
   - Step through a packet: the narration is announced as it changes (not read in full every step). The
     packet table, field tree and hex view are navigable by keyboard and make sense without sight (there
     is a text equivalent of the diagram, so no information is available only visually).
   - Check the OSI/TCP-IP panel and the bytes bar: layers are announced with whether the selected packet uses
     them.

Journeys the product documents also name that **do not exist in this build yet**: applying to an opportunity
and recruiter review. Add them to this list when TASK for those features lands; until then they cannot be
tested.

**Device and layout pass (TEST-037)**, with the keyboard and a screen reader each time:

- Phone, portrait and landscape (a real iPhone with Safari and a real Android with Chrome), and the
  browser's text size turned up to the largest setting: no clipped text, no sideways page scroll, nothing
  hidden behind the mobile tab bar or the on-screen keyboard, tap targets are comfortable.
- Browser zoom 200 % and 400 % (320 px wide) on desktop in Light and Dark.
- Tablet width (768 px) and a 1024 px window.
- System setting **Reduce motion** on: no large movement or parallax, nothing flashes, the page still works.
- System setting **High contrast / Forced colors** (Windows) and **Increase contrast** (macOS, iOS): content
  and focus indicators stay visible.
- Light, Dark and System theme: switch while a screen reader is running; the new state is announced, and the
  choice survives a reload with no flash of the wrong theme.

When a problem is found, file it with the journey, the tool and OS, what was announced or seen, and what
was expected. Re-run the route scan after fixing and add a component test if the problem was in a shared
primitive.
