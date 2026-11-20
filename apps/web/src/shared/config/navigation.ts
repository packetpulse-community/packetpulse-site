import {
  Activity,
  Award,
  BarChart3,
  BellRing,
  BookOpen,
  FileText,
  Gauge,
  HelpCircle,
  Home,

  MessageSquare,
  PenSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Tag,
  Terminal,
  User,
  Users,
  Video,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  isActiveAccount,
  matchesRule,
  type AccessRule,
  type AccessSubject,
} from "@/shared/auth/permissions";

// ONE navigation model for the whole app (Document 3 §2.2). The sidebar, the admin
// sidebar, the mobile bottom bar and the command palette are all derived from it by
// `navigationFor(user)`, so they can never disagree. Items the person cannot use are
// filtered OUT (no disabled clutter) — the server still re-checks every request.
//
// Mentor and Recruiter roles do not exist yet. When they do: add their items here
// with a `{ role: "mentor" }` / `{ role: "recruiter" }` rule (see the TODO block at
// the bottom of NAV_ITEMS) — no component needs to change.

export type NavGroupId =
  | "home"
  | "learn"
  | "practice"
  | "assessments"
  | "community"
  | "account"
  | "authoring"
  | "moderation"
  | "operations";

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  home: "Home",
  learn: "Learn",
  practice: "Practice",
  assessments: "Assessments",
  community: "Community",
  account: "Profile",
  authoring: "Authoring",
  moderation: "Moderation",
  operations: "Operations",
};

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  /** Who may see (and use) it. */
  access: AccessRule;
  /** Shown in the mobile bottom bar (the lead item of a group). */
  primary?: boolean;
  /** Short label for the bottom bar, where `label` is more specific (Learn vs Resources). */
  mobileLabel?: string;
  /** Extra search words for the command palette. */
  keywords?: readonly string[];
  /** "app" pages live in the member shell; "admin" pages inside /admin. */
  area: "app" | "admin";
  /**
   * The server answers this page without an approved, email-verified account
   * (public pages and the profile). Everything else needs `isActiveAccount`.
   */
  openToUnapproved?: boolean;
  /** In the member sidebar, hide this item while the item with this id is visible (admins get ONE Operations link instead of every moderation list). */
  collapseUnder?: string;
}

const ADMIN_ROLE: AccessRule = { role: "admin" };

export const NAV_ITEMS: readonly NavItem[] = [
  // Home
  { id: "home", label: "Home", href: "/dashboard", icon: Home, group: "home", access: "signed-in", primary: true, area: "app", openToUnapproved: true, keywords: ["dashboard", "overview"] },

  // Learn = Resources and Recordings
  { id: "resources", label: "Resources", href: "/resources", icon: FileText, group: "learn", access: "signed-in", primary: true, mobileLabel: "Learn", area: "app", keywords: ["learn", "study", "pdf", "guides", "articles"] },
  { id: "recordings", label: "Recordings", href: "/recordings", icon: Video, group: "learn", access: "signed-in", area: "app", keywords: ["learn", "video", "sessions", "lectures"] },

  // Practice = Tools
  { id: "tools", label: "Tools", href: "/tools", icon: Wrench, group: "practice", access: "signed-in", primary: true, mobileLabel: "Practice", area: "app", openToUnapproved: true, keywords: ["practice", "utilities", "labs"] },
  { id: "packet-lab", label: "Packet Lab", href: "/tools/packet-lab", icon: Activity, group: "practice", access: "signed-in", area: "app", openToUnapproved: true, keywords: ["practice", "packets", "osi", "tcp", "wireshark", "simulation", "protocol"] },
  { id: "network-tools", label: "Network Tools", href: "/network-tools", icon: Gauge, group: "practice", access: "signed-in", area: "app", keywords: ["ping", "traceroute", "dns", "port scan"] },

  // Assessments = Quizzes and Certificates
  { id: "quizzes", label: "Quizzes", href: "/quizzes", icon: HelpCircle, group: "assessments", access: "signed-in", area: "app", keywords: ["assessments", "attempt", "test", "exam"] },
  { id: "certificates", label: "My certificates", href: "/certificates", icon: Award, group: "assessments", access: "signed-in", area: "app", keywords: ["assessments", "certificate", "badge"] },

  // Community = Forums and Blogs
  { id: "forums", label: "Forums", href: "/forums", icon: Users, group: "community", access: "signed-in", primary: true, mobileLabel: "Community", area: "app", keywords: ["community", "discuss", "ask", "threads"] },
  { id: "blogs", label: "Blogs", href: "/blogs", icon: BookOpen, group: "community", access: "signed-in", area: "app", openToUnapproved: true, keywords: ["community", "articles", "posts"] },

  // Profile
  { id: "profile", label: "Profile", href: "/profile", icon: User, group: "account", access: "signed-in", area: "app", openToUnapproved: true, keywords: ["account", "settings", "password", "avatar"] },
  { id: "notification-settings", label: "Notification settings", href: "/settings/notifications", icon: BellRing, group: "account", access: "signed-in", area: "app", keywords: ["notifications", "email", "alerts", "preferences"] },

  // Authoring (instructors; admins reach the same tools from Operations)
  { id: "author-quiz", label: "Create a quiz", href: "/quizzes/new", icon: PenSquare, group: "authoring", access: { permission: "quizzes:author" }, area: "app", keywords: ["author", "build", "instructor", "new quiz"] },
  { id: "author-recording", label: "Add a recording", href: "/recordings", icon: Video, group: "authoring", access: { allOf: [{ permission: "recordings:create" }, { role: "instructor" }] }, area: "app", collapseUnder: "recordings", keywords: ["author", "upload", "instructor", "new recording"] },

  // Moderation: the admin moderation lists a permission opens (admin.controller: *:moderate)
  { id: "mod-blogs", label: "Moderate blogs", href: "/admin/blogs", icon: BookOpen, group: "moderation", access: { permission: "blogs:moderate" }, area: "admin", collapseUnder: "ops-overview", keywords: ["moderate", "pending", "review", "blog"] },
  { id: "mod-resources", label: "Moderate resources", href: "/admin/resources", icon: FileText, group: "moderation", access: { permission: "resources:moderate" }, area: "admin", collapseUnder: "ops-overview", keywords: ["moderate", "pending", "review", "resource"] },
  { id: "mod-recordings", label: "Moderate recordings", href: "/admin/recordings", icon: Video, group: "moderation", access: { permission: "recordings:moderate" }, area: "admin", collapseUnder: "ops-overview", keywords: ["moderate", "pending", "review", "recording"] },
  { id: "mod-forums", label: "Moderate forums", href: "/admin/forums", icon: MessageSquare, group: "moderation", access: { permission: "forums:moderate" }, area: "admin", collapseUnder: "ops-overview", keywords: ["moderate", "reports", "threads", "forum"] },

  // Operations (admin and super_admin)
  { id: "ops-overview", label: "Operations", href: "/admin", icon: ShieldCheck, group: "operations", access: ADMIN_ROLE, area: "admin", keywords: ["admin", "overview", "manage"] },
  { id: "ops-users", label: "Users", href: "/admin/users", icon: Users, group: "operations", access: { permission: "users:approve" }, area: "admin", keywords: ["approve", "pending", "members", "roles", "admin"] },
  { id: "ops-quizzes", label: "Manage quizzes", href: "/admin/quizzes", icon: HelpCircle, group: "operations", access: { allOf: [ADMIN_ROLE, { permission: "quizzes:author" }] }, area: "admin", collapseUnder: "ops-overview", keywords: ["admin", "author"] },
  { id: "ops-categories", label: "Categories", href: "/admin/categories", icon: Tag, group: "operations", access: { permission: "categories:manage" }, area: "admin", keywords: ["admin", "taxonomy", "tags"] },
  { id: "ops-analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3, group: "operations", access: { permission: "admin:view-analytics" }, area: "admin", keywords: ["admin", "stats", "dashboard", "numbers"] },
  { id: "ops-status", label: "System status", href: "/admin/status", icon: Activity, group: "operations", access: { permission: "admin:view-analytics" }, area: "admin", keywords: ["admin", "health", "uptime"] },
  { id: "ops-logs", label: "Logs", href: "/admin/logs", icon: ScrollText, group: "operations", access: { permission: "admin:view-analytics" }, area: "admin", keywords: ["admin", "audit", "errors"] },
  { id: "ops-api-docs", label: "API docs", href: "/admin/api-docs", icon: Terminal, group: "operations", access: ADMIN_ROLE, area: "admin", keywords: ["admin", "swagger", "openapi"] },
  { id: "ops-settings", label: "Platform settings", href: "/admin/settings", icon: Settings, group: "operations", access: { permission: "admin:manage-settings" }, area: "admin", keywords: ["admin", "maintenance", "configuration"] },

  // TODO(Mentor, Recruiter): once these roles exist, add e.g.
  //   { id: "reviews", label: "Reviews", group: "authoring", access: { anyOf: [{ role: "mentor" }, { role: "instructor" }, ADMIN_ROLE] }, ... }
  //   { id: "mentoring", ... access: { role: "mentor" } }
  //   Recruiter: Dashboard, Candidates, Positions — a separate set whose access is
  //   { role: "recruiter" }; member items must then exclude recruiters (add a `{ role: "member" }` style rule).
] as const;

export interface NavSection {
  id: NavGroupId;
  label: string;
  /** Whether the heading is worth printing (single-item sections read better without one). */
  showHeading: boolean;
  items: NavItem[];
}

export interface PaletteEntry {
  id: string;
  label: string;
  href: string;
  group: string;
  keywords: string[];
}

export interface NavigationModel {
  /** Member sidebar, in display order. */
  sidebar: NavSection[];
  /** Admin-area sidebar (also what a moderator sees inside /admin). */
  admin: NavSection[];
  /** The tabs of the mobile bottom bar; "More" opens `more`. */
  mobile: { tabs: NavItem[]; more: NavSection[] };
  /** Everything the palette may offer. */
  palette: PaletteEntry[];
  /** Every item this person can see, any area. */
  items: NavItem[];
}

export type NavUser = AccessSubject;

const GROUP_ORDER: NavGroupId[] = ["home", "learn", "practice", "assessments", "community", "account", "authoring", "moderation", "operations"];

interface CreateCommand {
  id: string;
  label: string;
  href: string;
  access: AccessRule;
  keywords: string[];
}

const CREATE_COMMANDS: readonly CreateCommand[] = [
  { id: "new-thread", label: "New forum thread", href: "/forums", access: { permission: "forums:create" }, keywords: ["ask", "discuss", "post"] },
  { id: "try-quiz", label: "Try a quiz", href: "/quizzes", access: { permission: "quizzes:attempt" }, keywords: ["attempt", "test"] },
  { id: "new-blog", label: "Write a blog post", href: "/blogs", access: { permission: "blogs:create" }, keywords: ["write", "article", "post"] },
  { id: "new-resource", label: "Share a resource", href: "/resources", access: { permission: "resources:create" }, keywords: ["upload", "add"] },
];

const SIGNED_OUT: NavigationModel = { sidebar: [], admin: [], mobile: { tabs: [], more: [] }, palette: [], items: [] };

function canSee(user: NavUser, item: NavItem): boolean {
  // An unapproved or unverified account is refused by the server on everything but
  // the public pages — so that is all we show.
  if (!item.openToUnapproved && !isActiveAccount(user)) return false;
  return matchesRule(user, item.access);
}

function toSections(items: readonly NavItem[]): NavSection[] {
  return GROUP_ORDER.map((group) => {
    const inGroup = items.filter((i) => i.group === group);
    return {
      id: group,
      label: NAV_GROUP_LABELS[group],
      showHeading: inGroup.length > 1 || group === "authoring",
      items: inGroup,
    };
  }).filter((s) => s.items.length > 0);
}

/** Pure: everything the shells render, for one person. `null` = signed out = nothing. */
export function navigationFor(user: NavUser | null | undefined): NavigationModel {
  if (!user) return SIGNED_OUT;

  const visible = NAV_ITEMS.filter((item) => canSee(user, item));
  const visibleIds = new Set(visible.map((i) => i.id));

  const appItems = visible.filter((i) => i.area === "app" || i.group === "moderation" || i.id === "ops-overview");
  const sidebarItems = appItems.filter((i) => !(i.collapseUnder && visibleIds.has(i.collapseUnder)));
  const sidebar = toSections(sidebarItems);

  // Admin sidebar: every admin-area page they may use, plus the way back to the app.
  const admin = toSections(visible.filter((i) => i.area === "admin"));

  const tabs = sidebarItems.filter((i) => i.primary);
  const tabIds = new Set(tabs.map((t) => t.id));
  const more = toSections(sidebarItems.filter((i) => !tabIds.has(i.id)));

  const palette: PaletteEntry[] = [
    ...visible.map((i) => ({
      id: i.id,
      label: i.label,
      href: i.href,
      group: i.area === "app" ? "Go to" : NAV_GROUP_LABELS[i.group],
      keywords: [...(i.keywords ?? [])],
    })),
    ...(isActiveAccount(user)
      ? CREATE_COMMANDS.filter((c) => matchesRule(user, c.access)).map((c) => ({
          id: c.id,
          label: c.label,
          href: c.href,
          group: "Create",
          keywords: c.keywords,
        }))
      : []),
  ];

  return { sidebar, admin, mobile: { tabs, more }, palette, items: visible };
}

/** The one item whose page the pathname is on: the longest matching href wins (/tools/packet-lab beats /tools). */
export function activeItemId(items: readonly NavItem[], pathname: string): string | null {
  let best: NavItem | null = null;
  for (const item of items) {
    const hit = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.id ?? null;
}

/** May this person open this /admin/** path? (Matches the item that owns the path.) */
export function canOpenAdminPath(user: NavUser | null | undefined, pathname: string): boolean {
  if (!user) return false;
  const adminItems = navigationFor(user).items.filter((i) => i.area === "admin");
  if (adminItems.length === 0) return false;
  const owner = NAV_ITEMS.filter((i) => i.area === "admin")
    .filter((i) => (i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  // A path no item owns (a new admin page) is open to any admin staff only.
  if (!owner) return adminItems.some((i) => i.id === "ops-overview");
  return adminItems.some((i) => i.id === owner.id);
}

/** Where a person with this access should land when they ask for an admin area they cannot use. */
export const NO_ACCESS_DESTINATION = { label: "Go to your dashboard", href: "/dashboard" } as const;

