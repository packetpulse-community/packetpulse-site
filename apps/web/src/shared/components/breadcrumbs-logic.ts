// Route-title registry for breadcrumbs. Replaces guessing titles from URL segments
// (which printed raw ids on detail pages). "*" matches one dynamic segment.

export interface Crumb {
  label: string;
  /** null = shown as text, because that path has no page of its own. */
  href: string | null;
}

interface RouteTitle {
  label: string;
  /** false when /that/path is not a real page (so the crumb is plain text). */
  linkable?: boolean;
}

export const ROUTE_TITLES: Readonly<Record<string, RouteTitle>> = {
  "/dashboard": { label: "Home" },
  "/resources": { label: "Resources" },
  "/resources/*": { label: "Resource" },
  "/recordings": { label: "Recordings" },
  "/recordings/*": { label: "Recording" },
  "/forums": { label: "Forums" },
  "/forums/*": { label: "Thread" },
  "/quizzes": { label: "Quizzes" },
  "/quizzes/new": { label: "New quiz" },
  "/quizzes/*": { label: "Quiz" },
  "/quizzes/*/edit": { label: "Edit" },
  "/certificates": { label: "My certificates" },
  "/network-tools": { label: "Network Tools" },
  "/tools": { label: "Tools" },
  "/tools/packet-lab": { label: "Packet Lab" },
  "/tools/packet-lab/*": { label: "Scenario" },
  "/profile": { label: "Profile" },
  "/settings": { label: "Settings", linkable: false },
  "/settings/notifications": { label: "Notification settings" },
  "/blogs": { label: "Blogs" },
  "/blogs/*": { label: "Blog post" },
  "/admin": { label: "Admin" },
  "/admin/users": { label: "Users" },
  "/admin/resources": { label: "Resources" },
  "/admin/recordings": { label: "Recordings" },
  "/admin/blogs": { label: "Blogs" },
  "/admin/forums": { label: "Forums" },
  "/admin/quizzes": { label: "Quizzes" },
  "/admin/quizzes/new": { label: "New quiz" },
  "/admin/quizzes/*": { label: "Quiz" },
  "/admin/quizzes/*/edit": { label: "Edit" },
  "/admin/categories": { label: "Categories" },
  "/admin/analytics": { label: "Analytics" },
  "/admin/status": { label: "System status" },
  "/admin/logs": { label: "Logs" },
  "/admin/api-docs": { label: "API docs" },
  "/admin/settings": { label: "Platform settings" },
};

// Looks like an identifier rather than a word: a UUID, a long number, a long hex/cuid
// string, or anything with digits mixed into a long token.
function looksLikeId(segment: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  if (/^\d+$/.test(segment)) return true;
  if (segment.length >= 16 && /\d/.test(segment) && !segment.includes("-")) return true;
  return segment.length >= 20 && /\d/.test(segment);
}

function titleCase(segment: string): string {
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function lookup(segments: string[]): RouteTitle | undefined {
  // An exact literal match wins (/quizzes/new), then a pattern with "*" (/quizzes/*).
  const exact = `/${segments.join("/")}`;
  if (ROUTE_TITLES[exact]) return ROUTE_TITLES[exact];
  const keys = Object.keys(ROUTE_TITLES).filter((k) => k.split("/").length === segments.length + 1);
  for (const key of keys) {
    const parts = key.split("/").slice(1);
    if (parts.every((p, i) => p === "*" || p === segments[i])) return ROUTE_TITLES[key];
  }
  return undefined;
}

/** The label for one crumb: registry first, then a readable guess — NEVER a raw id. */
export function crumbLabel(segments: string[]): string {
  const known = lookup(segments);
  if (known) return known.label;
  const last = segments[segments.length - 1] ?? "";
  return looksLikeId(last) ? "Details" : titleCase(last);
}

/** Breadcrumbs only on pages deeper than two levels (Document 2 §7): Home > Forums > Thread. */
export const MIN_SEGMENTS_FOR_BREADCRUMBS = 2;

/**
 * The crumbs for a pathname, or [] when none should show. `lastTitle` replaces the
 * final crumb's label when the page knows its real title (e.g. a thread's title).
 */
export function buildCrumbs(pathname: string, lastTitle?: string | null): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < MIN_SEGMENTS_FOR_BREADCRUMBS) return [];

  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];
  segments.forEach((_, index) => {
    const upTo = segments.slice(0, index + 1);
    const isLast = index === segments.length - 1;
    const entry = lookup(upTo);
    const label = isLast && lastTitle?.trim() ? lastTitle.trim() : crumbLabel(upTo);
    crumbs.push({ label, href: isLast || entry?.linkable === false ? null : `/${upTo.join("/")}` });
  });
  return crumbs;
}
