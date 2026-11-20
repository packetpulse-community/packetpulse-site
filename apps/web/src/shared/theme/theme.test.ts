import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  readStoredPreference,
  resolveTheme,
  themeCookie,
  THEME_INIT_SCRIPT,
} from "./theme";

describe("parseThemePreference", () => {
  it("accepts the three choices", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });
  it("defaults to light for anything else", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("light");
    for (const bad of [null, undefined, "", "Dark", "auto", 1, {}]) expect(parseThemePreference(bad)).toBe("light");
  });
});

describe("resolveTheme", () => {
  it("an explicit choice ignores the operating system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("system follows prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("readStoredPreference", () => {
  const storage = (value: string | null) => ({ getItem: () => value });
  it("prefers localStorage over the cookie", () => {
    expect(readStoredPreference(storage("dark"), "pp-theme=system")).toBe("dark");
  });
  it("falls back to the cookie when storage is empty or blocked", () => {
    expect(readStoredPreference(storage(null), "a=1; pp-theme=system; b=2")).toBe("system");
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredPreference(blocked, "pp-theme=dark")).toBe("dark");
  });
  it("is light with nothing saved or junk saved", () => {
    expect(readStoredPreference(null, "")).toBe("light");
    expect(readStoredPreference(storage("purple"), "pp-theme=blue")).toBe("light");
  });
});

describe("themeCookie", () => {
  it("is a year-long, site-wide, lax cookie", () => {
    expect(themeCookie("dark")).toBe("pp-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});

// The inline script runs before first paint and must agree with the functions above.
describe("THEME_INIT_SCRIPT", () => {
  function run(opts: { stored?: string | null; cookie?: string; systemDark?: boolean; storageThrows?: boolean }) {
    const classes = new Set<string>();
    const attrs: Record<string, string> = {};
    const root = {
      classList: {
        toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
      },
      setAttribute: (k: string, v: string) => (attrs[k] = v),
      style: { colorScheme: "" },
    };
    const localStorage = {
      getItem: () => {
        if (opts.storageThrows) throw new Error("blocked");
        return opts.stored ?? null;
      },
    };
    new Function("document", "localStorage", "window", THEME_INIT_SCRIPT)(
      { documentElement: root, cookie: opts.cookie ?? "" },
      localStorage,
      { matchMedia: () => ({ matches: !!opts.systemDark }) },
    );
    return { dark: classes.has("dark"), pref: attrs["data-theme-preference"], scheme: root.style.colorScheme };
  }

  it("is light by default, even when the system is dark", () => {
    expect(run({ systemDark: true })).toEqual({ dark: false, pref: "light", scheme: "light" });
  });
  it("applies a saved dark choice", () => {
    expect(run({ stored: "dark" })).toEqual({ dark: true, pref: "dark", scheme: "dark" });
  });
  it("system resolves through prefers-color-scheme", () => {
    expect(run({ stored: "system", systemDark: true }).dark).toBe(true);
    expect(run({ stored: "system", systemDark: false }).dark).toBe(false);
  });
  it("reads the cookie when storage is blocked", () => {
    expect(run({ storageThrows: true, cookie: "x=1; pp-theme=dark" }).dark).toBe(true);
  });
  it("ignores junk values", () => {
    expect(run({ stored: "neon" })).toEqual({ dark: false, pref: "light", scheme: "light" });
  });
  it("matches resolveTheme for every combination", () => {
    for (const pref of ["light", "dark", "system"] as const)
      for (const sys of [true, false])
        expect(run({ stored: pref, systemDark: sys }).dark).toBe(resolveTheme(pref, sys) === "dark");
  });
});
