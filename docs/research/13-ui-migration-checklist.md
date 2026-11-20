# 13. UI migration checklist (Signal Grove)

Generated 2026-11-20 by `apps/web/scripts/ui-migration-report.mjs`. Do not edit the tables by hand; re-run:

```bash
node apps/web/scripts/ui-migration-report.mjs > docs/research/13-ui-migration-checklist.md
```

Grove is the default theme and light is the default mode. Route groups marked **legacy** still contain hard-coded
dark glass classes, so they render inside a scoped dark surface (`data-legacy-dark`, see `shared/theme/LegacyScope.tsx`).

## How to migrate a route group

1. Restyle the group's screens with the semantic Tailwind names: `bg-background`, `bg-surface`, `bg-surface-subtle`,
   `border-border`, `text-text`, `text-text-secondary`, `bg-primary`, `text-primary-text`, `bg-accent` (lime), and the
   state names `success`, `warning`, `danger`, `info` (each with `-soft`). Shared primitives already follow the theme.
2. Check the screen in Light and Dark and at mobile width.
3. In `apps/web/src/shared/theme/legacy-routes.ts` change that group's `status` from `"legacy"` to `"migrated"`.
   That removes the dark surface for exactly those routes; no layout edit is needed.
4. Re-run the command above. The count for the feature should be 0.

`scope` tells what goes dark while a group is legacy: **page** = the whole page (public pages and auth screens),
**content** = only the content area inside the app shell (the sidebar, top bar and tab bar stay themed).

## Route groups

| Route group | Routes | Status | Dark scope while legacy |
| --- | --- | --- | --- |
| Design system | `/design-system` | migrated | none |
| Home (landing) | `/` | **legacy** | page |
| About, contact, privacy, terms | `/about` `/contact` `/privacy` `/terms` | **legacy** | page |
| Blogs (public) | `/blogs` | **legacy** | page |
| Tools hub (public) | `/tools` | **legacy** | page |
| Sign in, register, recovery | `/login` `/register` `/forgot-password` `/verify-email` | **legacy** | page |
| Maintenance and session refresh | `/maintenance` `/refresh` | **legacy** | page |
| Certificate verification (public) | `/certificates/verify` | **legacy** | page |
| Dashboard | `/dashboard` | **legacy** | content |
| Quizzes, resources, recordings, certificates | `/quizzes` `/resources` `/recordings` `/certificates` | **legacy** | content |
| Forums and network tools | `/forums` `/network-tools` | **legacy** | content |
| Profile and skills picker | `/profile` | migrated | none |
| Notifications and settings | `/notifications` `/settings` | **legacy** | content |
| Admin | `/admin` | **legacy** | content |

Shell and chrome (always themed, both modes): app sidebar, top bar, mobile tab bar and More sheet, command palette,
breadcrumbs, admin sidebar and top bar, public Navbar and Footer, shared primitives, status/error screens, `/design-system`.

## Remaining hard-coded colour classes

Counts palette utilities (`bg-indigo-600`, `text-white`, `dark:border-slate-800`, `from-slate-900` ...) and the old
`glass-*` recipe classes in `.tsx`, `.ts` and `.css` files (comments and tests excluded).

| Area | Serves | Classes | Files with hits | Files |
| --- | --- | ---: | ---: | ---: |
| `features/admin` | /admin/* | 55 | 10 | 38 |
| `features/auth` | /login /register /forgot-password /verify-email | 9 | 3 | 8 |
| `features/blogs` | /blogs, /blogs/[slug] | 22 | 6 | 11 |
| `features/categories` | /admin/categories | 0 | 0 | 2 |
| `features/dashboard` | /dashboard | 2 | 1 | 2 |
| `features/design-system` | /design-system | 0 | 0 | 4 |
| `features/forums` | /forums, /forums/[id] | 3 | 2 | 5 |
| `features/landing` | /, /about, /contact (and Navbar/Footer, migrated) | 94 | 16 | 19 |
| `features/network-tools` | /network-tools | 2 | 1 | 2 |
| `features/notifications` | /notifications, /settings/notifications | 9 | 2 | 5 |
| `features/packet-lab` | /tools/packet-lab/* | 156 | 10 | 14 |
| `features/profile` | /profile | 0 | 0 | 5 |
| `features/quizzes` | /quizzes/*, /certificates | 9 | 4 | 8 |
| `features/recordings` | /recordings/* | 8 | 3 | 6 |
| `features/resources` | /resources/* | 1 | 1 | 7 |
| `features/skills` | /profile, /admin/taxonomy | 0 | 0 | 4 |
| `shared (excluding styles)` |  | 0 | 0 | 67 |
| `app (route files)` |  | 47 | 14 | 68 |
| **Total** | | **417** | | |

