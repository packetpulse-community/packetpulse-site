// Route registry for the Signal Grove migration (docs/research/13-ui-migration-checklist.md).
//
// Grove is the default theme, but many feature screens still carry hard-coded dark glass
// classes (text-white, bg-slate-900/50, indigo gradients). Those screens stay readable under a
// light default because they render inside a "legacy dark" scope: a `.dark` element that
// re-declares the dark Grove tokens for its subtree only (see LegacyScope.tsx).
//
// TO MIGRATE A ROUTE GROUP: restyle its screens with the semantic Tailwind names (bg-surface,
// text-text, border-border, text-primary, ...), then flip its `status` to "migrated" here. That
// is the only switch; no layout needs editing. The unit test (legacy-routes.test.ts) fails if an
// app/**/page.tsx is not covered by a group, so new routes cannot be forgotten.
//
// `scope` says how much of the page goes dark while a group is legacy:
//   "page"    the whole page (public pages and auth screens that own their whole background)
//   "content" only the content area; the app shell (sidebar, top bar, tab bar) stays themed

export type RouteStatus = "migrated" | "legacy";
export type LegacyScopeKind = "page" | "content";

export interface RouteGroup {
  id: string;
  label: string;
  /** Path prefixes ("/forums" matches "/forums" and "/forums/1"). "/" matches only the home page. */
  prefixes: readonly string[];
  status: RouteStatus;
  scope: LegacyScopeKind;
}

export const ROUTE_GROUPS: readonly RouteGroup[] = [
  { id: "design-system", label: "Design system", prefixes: ["/design-system"], status: "migrated", scope: "page" },
  { id: "landing", label: "Home (landing)", prefixes: ["/"], status: "legacy", scope: "page" },
  { id: "marketing", label: "About, contact, privacy, terms", prefixes: ["/about", "/contact", "/privacy", "/terms"], status: "legacy", scope: "page" },
  { id: "blogs", label: "Blogs (public)", prefixes: ["/blogs"], status: "legacy", scope: "page" },
  { id: "tools", label: "Tools hub (public)", prefixes: ["/tools"], status: "legacy", scope: "page" },
  { id: "auth", label: "Sign in, register, recovery", prefixes: ["/login", "/register", "/forgot-password", "/verify-email"], status: "legacy", scope: "page" },
  { id: "system-pages", label: "Maintenance and session refresh", prefixes: ["/maintenance", "/refresh"], status: "legacy", scope: "page" },
  { id: "certificate-verify", label: "Certificate verification (public)", prefixes: ["/certificates/verify"], status: "legacy", scope: "page" },
  { id: "dashboard", label: "Dashboard", prefixes: ["/dashboard"], status: "legacy", scope: "content" },
  { id: "learning", label: "Quizzes, resources, recordings, certificates", prefixes: ["/quizzes", "/resources", "/recordings", "/certificates"], status: "legacy", scope: "content" },
  { id: "community", label: "Forums and network tools", prefixes: ["/forums", "/network-tools"], status: "legacy", scope: "content" },
  { id: "profile", label: "Profile and skills picker", prefixes: ["/profile"], status: "migrated", scope: "content" },
  { id: "account", label: "Notifications and settings", prefixes: ["/notifications", "/settings"], status: "legacy", scope: "content" },
  { id: "admin", label: "Admin", prefixes: ["/admin"], status: "legacy", scope: "content" },
];

function matches(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Longest matching prefix wins ("/certificates/verify/x" beats "/certificates"). */
export function matchRouteGroup(pathname: string): RouteGroup | undefined {
  let best: { group: RouteGroup; length: number } | undefined;
  for (const group of ROUTE_GROUPS) {
    for (const prefix of group.prefixes) {
      if (matches(pathname, prefix) && (!best || prefix.length > best.length)) best = { group, length: prefix.length };
    }
  }
  return best?.group;
}

/**
 * Which dark scope applies to this path, if any. Unlisted paths (404s, future routes) are treated
 * as migrated: new code is written against the tokens.
 */
export function legacyScopeFor(pathname: string | null | undefined): LegacyScopeKind | null {
  const group = pathname ? matchRouteGroup(pathname) : undefined;
  return group && group.status === "legacy" ? group.scope : null;
}
