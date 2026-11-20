// Theme preference and resolution (Document 2: light by default, Light / Dark / System switch).
// Pure logic so it is unit tested; the browser side lives in useTheme.ts and the no-flash
// script below, which applies the same rules before first paint.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";
export const THEME_STORAGE_KEY = "pp-theme";
export const THEME_COOKIE_NAME = "pp-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Anything that is not exactly "light", "dark" or "system" falls back to the default (light). */
export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : DEFAULT_THEME_PREFERENCE;
}

/** System resolves through prefers-color-scheme; an explicit choice always wins. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/** Reads a saved preference: localStorage first, then the cookie. Never throws. */
export function readStoredPreference(
  storage: Pick<Storage, "getItem"> | null | undefined,
  cookieString: string | null | undefined,
): ThemePreference {
  try {
    const fromStorage = storage?.getItem(THEME_STORAGE_KEY);
    if (fromStorage) return parseThemePreference(fromStorage);
  } catch {
    // storage blocked (private mode, cleared site data): fall through to the cookie
  }
  const match = /(?:^|;\s*)pp-theme=([^;]*)/.exec(cookieString ?? "");
  return parseThemePreference(match?.[1]);
}

/** Cookie string for document.cookie. Not httpOnly on purpose: the client switch writes it. */
export function themeCookie(preference: ThemePreference): string {
  return `${THEME_COOKIE_NAME}=${preference}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/**
 * Inline script run in <head> before first paint (no flash of the wrong theme). It must stay
 * dependency free and mirror readStoredPreference + resolveTheme; theme.test.ts executes it
 * against fake environments to keep the two in step.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,p=null;try{p=localStorage.getItem("pp-theme")}catch(e){}if(!p){var m=/(?:^|;\\s*)pp-theme=([^;]*)/.exec(document.cookie);p=m&&m[1]}if(p!=="dark"&&p!=="system")p="light";var k=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",k);d.setAttribute("data-theme-preference",p);d.style.colorScheme=k?"dark":"light"}catch(e){}})();`;
