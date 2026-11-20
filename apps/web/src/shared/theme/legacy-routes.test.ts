import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { legacyScopeFor, matchRouteGroup, ROUTE_GROUPS } from "./legacy-routes";

const APP_DIR = join(__dirname, "..", "..", "app");

function pagePaths(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pagePaths(full, out);
    else if (name === "page.tsx") {
      const segments = relative(APP_DIR, dir)
        .split(sep)
        .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      out.push("/" + segments.join("/"));
    }
  }
  return out;
}

describe("legacy route registry", () => {
  it("covers every page in app/ with an explicit group", () => {
    const missing = pagePaths(APP_DIR)
      .map((p) => p.replace(/\[[^\]]+\]/g, "x"))
      .filter((p) => !matchRouteGroup(p));
    expect(missing, `routes not in ROUTE_GROUPS: ${missing.join(", ")}`).toEqual([]);
  });

  it("has unique ids and no prefix claimed twice", () => {
    expect(new Set(ROUTE_GROUPS.map((g) => g.id)).size).toBe(ROUTE_GROUPS.length);
    const prefixes = ROUTE_GROUPS.flatMap((g) => g.prefixes);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("matches on segment boundaries, longest prefix first", () => {
    expect(matchRouteGroup("/forums/12")?.id).toBe("community");
    expect(matchRouteGroup("/forumsx")).toBeUndefined();
    expect(matchRouteGroup("/certificates")?.id).toBe("learning");
    expect(matchRouteGroup("/certificates/verify/ABC")?.id).toBe("certificate-verify");
    expect(matchRouteGroup("/")?.id).toBe("landing");
    expect(matchRouteGroup("/anything")).toBeUndefined();
  });

  it("scopes legacy routes and leaves migrated and unknown ones themed", () => {
    expect(legacyScopeFor("/login")).toBe("page");
    expect(legacyScopeFor("/dashboard")).toBe("content");
    expect(legacyScopeFor("/admin/users")).toBe("content");
    expect(legacyScopeFor("/design-system")).toBeNull();
    expect(legacyScopeFor("/no-such-page")).toBeNull();
    expect(legacyScopeFor(null)).toBeNull();
  });
});
