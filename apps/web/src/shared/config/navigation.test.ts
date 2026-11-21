import { describe, expect, it } from "vitest";
import { activeItemId, canOpenAdminPath, navigationFor, type NavUser } from "./navigation";

// Permission sets copied from apps/backend/prisma/seed.ts (ROLE_PERMISSIONS).
const MEMBER = ["blogs:create", "resources:create", "recordings:create", "forums:create", "quizzes:attempt"];
const MODERATOR = ["blogs:moderate", "resources:moderate", "recordings:moderate", "forums:moderate"];
const INSTRUCTOR = ["recordings:create", "quizzes:author"];
const ADMIN = [
  ...MEMBER, "blogs:publish", "blogs:moderate", "resources:moderate", "recordings:moderate", "forums:moderate",
  "quizzes:author", "users:approve", "users:manage-roles", "admin:clean-data", "admin:view-analytics",
  "admin:manage-settings", "categories:manage", "skills:manage",
];

function user(roles: string[], permissions: string[], over: Partial<NavUser> = {}): NavUser {
  return { roles, permissions, isApproved: true, emailVerified: true, ...over };
}

// The backend returns the UNION of the person's roles' permissions.
const member = user(["member"], MEMBER);
const moderator = user(["member", "moderator"], [...MEMBER, ...MODERATOR]);
const instructor = user(["member", "instructor"], [...MEMBER, ...INSTRUCTOR]);
const admin = user(["member", "admin"], ADMIN);
const superAdmin = user(["super_admin"], []);

const hrefs = (u: NavUser | null) => navigationFor(u).items.map((i) => i.href);
const sidebarLabels = (u: NavUser | null) => navigationFor(u).sidebar.flatMap((s) => s.items.map((i) => i.label));

const MEMBER_PAGES = [
  "/dashboard", "/resources", "/recordings", "/tools", "/tools/packet-lab", "/network-tools",
  "/quizzes", "/certificates", "/forums", "/blogs", "/profile", "/settings/notifications",
];

describe("navigationFor", () => {
  it("returns nothing when signed out", () => {
    const nav = navigationFor(null);
    expect(nav.sidebar).toEqual([]);
    expect(nav.admin).toEqual([]);
    expect(nav.mobile.tabs).toEqual([]);
    expect(nav.palette).toEqual([]);
  });

  it("member: the Document 3 member pages and no role extras", () => {
    expect(hrefs(member).sort()).toEqual([...MEMBER_PAGES].sort());
    expect(navigationFor(member).admin).toEqual([]);
    expect(hrefs(member).some((h) => h.startsWith("/admin"))).toBe(false);
    expect(hrefs(member)).not.toContain("/quizzes/new");
  });

  it("member sidebar is grouped Home, Learn, Practice, Assessments, Community, Profile", () => {
    expect(navigationFor(member).sidebar.map((s) => s.label)).toEqual([
      "Home", "Learn", "Practice", "Assessments", "Community", "Profile",
    ]);
  });

  it("moderator: member pages plus exactly the four moderation lists", () => {
    const extra = hrefs(moderator).filter((h) => !MEMBER_PAGES.includes(h));
    expect(extra.sort()).toEqual(["/admin/blogs", "/admin/forums", "/admin/recordings", "/admin/resources"]);
    expect(navigationFor(moderator).sidebar.map((s) => s.label)).toContain("Moderation");
    expect(hrefs(moderator)).not.toContain("/admin/users");
    expect(hrefs(moderator)).not.toContain("/admin");
  });

  it("moderator with only one moderate permission sees only that list", () => {
    const forumsOnly = user(["member", "moderator"], [...MEMBER, "forums:moderate"]);
    expect(hrefs(forumsOnly).filter((h) => h.startsWith("/admin"))).toEqual(["/admin/forums"]);
  });

  it("instructor: member pages plus authoring, no moderation or operations", () => {
    const extra = hrefs(instructor).filter((h) => !MEMBER_PAGES.includes(h));
    expect(extra).toEqual(["/quizzes/new"]);
    expect(hrefs(instructor)).toContain("/quizzes/new");
    expect(sidebarLabels(instructor)).toContain("Create a quiz");
    expect(navigationFor(instructor).admin).toEqual([]);
  });

  it("a plain member holding recordings:create does not get the authoring entries", () => {
    expect(sidebarLabels(member)).not.toContain("Add a recording");
    expect(navigationFor(member).palette.map((p) => p.label)).not.toContain("Add a recording");
  });

  it("admin: Operations replaces the individual moderation links in the sidebar", () => {
    const nav = navigationFor(admin);
    const labels = sidebarLabels(admin);
    expect(labels).toContain("Operations");
    expect(labels).not.toContain("Moderate blogs");
    expect(nav.sidebar.map((s) => s.label)).toContain("Operations");
    expect(nav.sidebar.map((s) => s.label)).not.toContain("Moderation");
  });

  it("admin sidebar inside /admin lists every admin page", () => {
    const adminHrefs = navigationFor(admin).admin.flatMap((s) => s.items.map((i) => i.href));
    expect(adminHrefs).toEqual(
      expect.arrayContaining([
        "/admin", "/admin/users", "/admin/resources", "/admin/recordings", "/admin/blogs", "/admin/forums",
        "/admin/quizzes", "/admin/categories", "/admin/taxonomy", "/admin/analytics", "/admin/status", "/admin/logs",
        "/admin/api-docs", "/admin/settings", "/admin/feature-flags", "/admin/data-requests",
      ]),
    );
  });

  it("super_admin (no stored permissions) gets everything an admin gets", () => {
    expect(hrefs(superAdmin).sort()).toEqual(hrefs(admin).sort());
  });

  it("user with no roles and no permissions sees only the open pages", () => {
    const nobody = user([], []);
    expect(hrefs(nobody).sort()).toEqual(
      ["/dashboard", "/tools", "/tools/packet-lab", "/blogs", "/profile", "/settings/notifications", "/resources", "/recordings", "/network-tools", "/quizzes", "/certificates", "/forums"].sort(),
    );
    // Signed-in pages are shown on a signed-in empty-permission account; role extras never are.
    expect(hrefs(nobody).some((h) => h.startsWith("/admin"))).toBe(false);
    expect(navigationFor(nobody).palette.filter((p) => p.group === "Create")).toEqual([]);
  });

  it("unapproved member: only what the backend still answers (public pages and profile)", () => {
    const pending = user(["member"], MEMBER, { isApproved: false });
    expect(hrefs(pending).sort()).toEqual(["/blogs", "/dashboard", "/profile", "/tools", "/tools/packet-lab"].sort());
    expect(navigationFor(pending).palette.filter((p) => p.group === "Create")).toEqual([]);
  });

  it("approved member with an unverified email is treated like a pending one", () => {
    const unverified = user(["member"], MEMBER, { emailVerified: false });
    expect(hrefs(unverified)).not.toContain("/forums");
    expect(hrefs(unverified)).toContain("/dashboard");
  });

  it("an unapproved moderator gets no moderation links (the server refuses them)", () => {
    const pendingMod = user(["moderator"], MODERATOR, { isApproved: false });
    expect(hrefs(pendingMod).some((h) => h.startsWith("/admin"))).toBe(false);
  });

  it("admins are never treated as pending (ApprovedGuard bypass)", () => {
    const freshAdmin = user(["admin"], ADMIN, { isApproved: false, emailVerified: false });
    expect(hrefs(freshAdmin)).toContain("/admin");
    expect(hrefs(freshAdmin)).toContain("/forums");
  });

  describe("mobile bar", () => {
    it("has Home, Learn, Practice, Community and the rest behind More", () => {
      const { tabs, more } = navigationFor(member).mobile;
      expect(tabs.map((t) => t.mobileLabel ?? t.label)).toEqual(["Home", "Learn", "Practice", "Community"]);
      const moreHrefs = more.flatMap((s) => s.items.map((i) => i.href));
      expect(moreHrefs).toEqual(expect.arrayContaining(["/recordings", "/quizzes", "/certificates", "/blogs", "/profile", "/settings/notifications"]));
      // Nothing appears twice.
      const all = [...tabs.map((t) => t.href), ...moreHrefs];
      expect(new Set(all).size).toBe(all.length);
    });

    it("moderators find moderation under More", () => {
      const moreHrefs = navigationFor(moderator).mobile.more.flatMap((s) => s.items.map((i) => i.href));
      expect(moreHrefs).toContain("/admin/forums");
    });

    it("a pending account gets only the tabs it can open", () => {
      const pending = user(["member"], MEMBER, { isApproved: false });
      expect(navigationFor(pending).mobile.tabs.map((t) => t.label)).toEqual(["Home", "Tools"]);
    });
  });

  describe("command palette", () => {
    it("is role-aware instead of hard-coding admin entries", () => {
      const labels = (u: NavUser) => navigationFor(u).palette.map((p) => p.label);
      expect(labels(member)).not.toContain("Users");
      expect(labels(member)).not.toContain("Analytics");
      expect(labels(moderator)).toContain("Moderate forums");
      expect(labels(moderator)).not.toContain("Analytics");
      expect(labels(admin)).toEqual(expect.arrayContaining(["Users", "Analytics", "Moderate resources"]));
      expect(labels(instructor)).toContain("Create a quiz");
    });

    it("keeps keywords and Create commands only for what the person may do", () => {
      const palette = navigationFor(member).palette;
      expect(palette.find((p) => p.id === "packet-lab")?.keywords).toContain("wireshark");
      expect(palette.filter((p) => p.group === "Create").map((p) => p.label)).toEqual(
        expect.arrayContaining(["New forum thread", "Try a quiz"]),
      );
      const readOnly = user(["member"], ["quizzes:attempt"]);
      expect(navigationFor(readOnly).palette.map((p) => p.label)).not.toContain("New forum thread");
    });

    it("every entry has a unique id", () => {
      const ids = navigationFor(admin).palette.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe("activeItemId", () => {
  const items = navigationFor(admin).items;
  it("picks the longest matching href", () => {
    expect(activeItemId(items, "/tools/packet-lab/some-scenario")).toBe("packet-lab");
    expect(activeItemId(items, "/tools")).toBe("tools");
    expect(activeItemId(items, "/quizzes/new")).toBe("author-quiz");
    expect(activeItemId(items, "/forums/abc")).toBe("forums");
  });
  it("matches /admin only exactly, so it does not light up for every admin page", () => {
    expect(activeItemId(items, "/admin")).toBe("ops-overview");
    expect(activeItemId(items, "/admin/users")).toBe("ops-users");
  });
  it("returns null off the map", () => {
    expect(activeItemId(items, "/nope")).toBeNull();
  });
});

describe("canOpenAdminPath", () => {
  it("lets admins into every admin page", () => {
    for (const p of ["/admin", "/admin/users", "/admin/settings", "/admin/quizzes/new", "/admin/unknown-page"]) {
      expect(canOpenAdminPath(admin, p)).toBe(true);
    }
    expect(canOpenAdminPath(superAdmin, "/admin/settings")).toBe(true);
  });
  it("lets a moderator into their moderation lists only", () => {
    expect(canOpenAdminPath(moderator, "/admin/forums")).toBe(true);
    expect(canOpenAdminPath(moderator, "/admin/blogs")).toBe(true);
    expect(canOpenAdminPath(moderator, "/admin/users")).toBe(false);
    expect(canOpenAdminPath(moderator, "/admin")).toBe(false);
    expect(canOpenAdminPath(moderator, "/admin/unknown-page")).toBe(false);
  });
  it("refuses members, instructors, pending accounts and signed-out visitors", () => {
    expect(canOpenAdminPath(member, "/admin")).toBe(false);
    expect(canOpenAdminPath(instructor, "/admin/quizzes")).toBe(false);
    expect(canOpenAdminPath(user(["moderator"], MODERATOR, { isApproved: false }), "/admin/forums")).toBe(false);
    expect(canOpenAdminPath(null, "/admin")).toBe(false);
  });
});
