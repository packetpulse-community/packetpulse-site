"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { ComponentShowcase } from "./ComponentShowcase";
import { TokenSections } from "./TokenSections";

const THEMES = [
  { key: "current", label: "Current look" },
  { key: "grove-light", label: "Grove light" },
  { key: "grove-dark", label: "Grove dark" },
] as const;

type ThemeKey = (typeof THEMES)[number]["key"];

export function DesignSystemView() {
  const [theme, setTheme] = useState<ThemeKey>("grove-light");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const groupId = useId();
  const grove = theme !== "current";

  return (
    <div
      ref={wrapperRef}
      data-theme={grove ? "grove" : undefined}
      data-mode={theme === "grove-light" ? "light" : undefined}
      className={cn(
        "min-h-screen",
        theme === "grove-dark" && "dark",
        grove ? "bg-grove-page text-grove-text font-grove-sans" : "bg-background text-foreground",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground"
      >
        Skip to content
      </a>
      <main id="main" className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold sm:text-4xl">PacketPulse design system</h1>
          <p className="max-w-prose text-base">
            Signal Grove tokens and components from Document 2. The Grove theme is opt-in: it only applies inside an
            element with <code className="font-grove-mono">data-theme=&quot;grove&quot;</code> (add the{" "}
            <code className="font-grove-mono">dark</code> class for dark). Nothing else in the app uses it yet.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Theme</legend>
            <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
              {THEMES.map((t) => {
                const id = `${groupId}-${t.key}`;
                return (
                  <label
                    key={t.key}
                    htmlFor={id}
                    className={cn(
                      "cursor-pointer rounded-md border px-3 py-2 text-sm font-medium has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-offset-2",
                      grove
                        ? "rounded-grove-control border-grove-control has-[:focus-visible]:ring-grove-focus has-[:focus-visible]:ring-offset-grove-page"
                        : "has-[:focus-visible]:ring-ring",
                      theme === t.key && (grove ? "bg-grove-subtle" : "bg-accent"),
                    )}
                  >
                    <input
                      id={id}
                      type="radio"
                      name={`${groupId}-theme`}
                      className="sr-only"
                      checked={theme === t.key}
                      onChange={() => setTheme(t.key)}
                    />
                    {theme === t.key ? "✓ " : ""}
                    {t.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <nav aria-label="On this page">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm underline underline-offset-4">
              <li><a href="#swatches">Tokens</a></li>
              <li><a href="#contrast">Contrast</a></li>
              <li><a href="#shape">Shape and type</a></li>
              <li><a href="#buttons">Buttons</a></li>
              <li><a href="#chips">Chips</a></li>
              <li><a href="#cards">Cards</a></li>
              <li><a href="#alerts">Alerts</a></li>
            </ul>
          </nav>
        </header>

        <TokenSections wrapperRef={wrapperRef} themeKey={theme} />
        <ComponentShowcase grove={grove} />
      </main>
    </div>
  );
}
