"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  parseThemePreference,
  readStoredPreference,
  resolveTheme,
  themeCookie,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

// The DOM is the source of truth: the init script (and applyTheme below) write
// data-theme-preference and the `dark` class on <html>, so server markup, the script and React
// can never disagree about what is applied. Subscribers are notified on our own changes, on
// system colour-scheme changes while "system" is chosen, and on changes from other tabs.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const dark = resolveTheme(preference, systemDark()) === "dark";
  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme-preference", preference);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // blocked storage: the cookie below still persists it
  }
  document.cookie = themeCookie(preference);
  applyTheme(preference);
  notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    const current = parseThemePreference(document.documentElement.getAttribute("data-theme-preference"));
    if (current === "system") applyTheme("system");
    onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    applyTheme(readStoredPreference(localStorage, document.cookie));
    onChange();
  };
  mql.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    mql.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

const getPreference = (): ThemePreference =>
  parseThemePreference(document.documentElement.getAttribute("data-theme-preference"));
const getResolved = (): ResolvedTheme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
} {
  const preference = useSyncExternalStore(subscribe, getPreference, () => "light" as const);
  const resolved = useSyncExternalStore(subscribe, getResolved, () => "light" as const);
  const setPreference = useCallback((p: ThemePreference) => setThemePreference(p), []);
  return { preference, resolved, setPreference };
}
