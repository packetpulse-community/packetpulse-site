"use client";

import { useRef } from "react";
import { ThemeSwitch } from "@/shared/theme/ThemeSwitch";
import { ROUTE_GROUPS } from "@/shared/theme/legacy-routes";
import { useTheme } from "@/shared/theme/useTheme";
import { ComponentShowcase } from "./ComponentShowcase";
import { TokenSections } from "./TokenSections";

// The design system now shows the LIVE theme: Signal Grove is the app default, light unless the
// visitor chose otherwise. The switch below is the same one the app shell uses, so what you see
// here is what every migrated screen shows.
const SEMANTIC_SAMPLES = [
  { name: "background", cls: "bg-background" },
  { name: "surface", cls: "bg-surface" },
  { name: "surface-subtle", cls: "bg-surface-subtle" },
  { name: "primary", cls: "bg-primary" },
  { name: "accent", cls: "bg-accent" },
  { name: "success-soft", cls: "bg-success-soft" },
  { name: "warning-soft", cls: "bg-warning-soft" },
  { name: "danger-soft", cls: "bg-danger-soft" },
  { name: "info-soft", cls: "bg-info-soft" },
];

export function DesignSystemView() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { preference, resolved } = useTheme();
  const legacy = ROUTE_GROUPS.filter((g) => g.status === "legacy");

  return (
    <div ref={wrapperRef} className="min-h-screen bg-background font-grove-sans text-text">
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
            Signal Grove tokens and components from Document 2. This is the app&apos;s default theme: light unless you pick
            otherwise, applied before first paint and remembered in this browser. Screens adopt it with the semantic
            Tailwind names (<code className="font-grove-mono">bg-background</code>,{" "}
            <code className="font-grove-mono">bg-surface</code>, <code className="font-grove-mono">border-border</code>,{" "}
            <code className="font-grove-mono">text-text</code>, <code className="font-grove-mono">bg-primary</code>, …).
          </p>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Theme</p>
            <ThemeSwitch />
            <p role="status" className="text-sm text-text-secondary">
              Live theme: <strong className="text-text">{resolved}</strong> (your choice: {preference}).
            </p>
          </div>
          <nav aria-label="On this page">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm underline underline-offset-4">
              <li><a href="#semantic">Semantic names</a></li>
              <li><a href="#swatches">Tokens</a></li>
              <li><a href="#contrast">Contrast</a></li>
              <li><a href="#shape">Shape and type</a></li>
              <li><a href="#buttons">Buttons</a></li>
              <li><a href="#chips">Chips</a></li>
              <li><a href="#cards">Cards</a></li>
              <li><a href="#alerts">Alerts</a></li>
              <li><a href="#legacy">Legacy routes</a></li>
            </ul>
          </nav>
        </header>

        <section aria-labelledby="semantic" className="space-y-4">
          <h2 id="semantic" className="text-2xl font-semibold">
            Semantic Tailwind names
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SEMANTIC_SAMPLES.map((s) => (
              <li key={s.name} className="flex items-center gap-2 rounded-grove-card border border-border bg-surface p-2 text-sm">
                <span aria-hidden="true" className={`h-8 w-8 shrink-0 rounded-grove-tag border border-control ${s.cls}`} />
                <code className="font-grove-mono text-xs">{s.cls}</code>
              </li>
            ))}
          </ul>
        </section>

        <TokenSections wrapperRef={wrapperRef} themeKey={resolved} />
        <ComponentShowcase grove />

        <section aria-labelledby="legacy" className="space-y-3">
          <h2 id="legacy" className="text-2xl font-semibold">
            Routes still on the legacy dark surface
          </h2>
          <p className="max-w-prose text-sm text-text-secondary">
            These route groups still use hard-coded dark glass classes, so they render inside a scoped dark surface
            (<code className="font-grove-mono">data-legacy-dark</code>) until they are restyled. Flip a group to
            &quot;migrated&quot; in <code className="font-grove-mono">shared/theme/legacy-routes.ts</code> once done.
          </p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {legacy.map((g) => (
              <li key={g.id} className="rounded-grove-card border border-border bg-surface p-3">
                <span className="font-semibold">{g.label}</span>
                <code className="block font-grove-mono text-xs text-text-secondary">{g.prefixes.join("  ")}</code>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
