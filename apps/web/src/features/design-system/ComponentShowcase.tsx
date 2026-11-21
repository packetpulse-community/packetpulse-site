"use client";

import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/primitives/Alert";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardMainLink, CardTitle } from "@/shared/ui/primitives/Card";
import { StatusChip, VerificationChip, VERIFICATION_LABELS, type VerificationLabel } from "@/shared/ui/primitives/StatusChip";

// Every state is shown twice: a real control (try hover, Tab, click) and a "forced"
// copy so hover, focus and pressed can be read at a glance without interaction.
const FOCUS = "ring-[3px] ring-grove-focus ring-offset-2 ring-offset-grove-page";

const GROVE_BUTTONS = [
  {
    variant: "grove-primary",
    label: "Primary",
    hover: "bg-grove-brand-hover",
    pressed: "bg-grove-brand-pressed translate-y-px",
  },
  {
    variant: "grove-secondary",
    label: "Secondary",
    hover: "bg-grove-subtle",
    pressed: "bg-grove-subtle translate-y-px",
  },
  {
    variant: "grove-lime",
    label: "Lime",
    hover: "bg-grove-lime-hover",
    pressed: "bg-grove-lime-pressed translate-y-px",
  },
  {
    variant: "grove-destructive",
    label: "Destructive",
    hover: "bg-grove-destructive-hover",
    pressed: "bg-grove-destructive-pressed translate-y-px",
  },
] as const;

function StateCell({ caption, children, onDark }: { caption: string; children: React.ReactNode; onDark?: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className={`text-xs font-semibold ${onDark ? "text-grove-on-brand" : "text-grove-text-secondary"}`}>{caption}</span>
      {children}
    </div>
  );
}

function ButtonRow({ spec, dark }: { spec: (typeof GROVE_BUTTONS)[number]; dark?: boolean }) {
  const v = spec.variant;
  return (
    <div
      className={
        dark
          ? "rounded-grove-card bg-grove-teal p-4"
          : "rounded-grove-card border border-grove-border bg-grove-surface p-4"
      }
    >
      <h3 className={`mb-3 text-sm font-semibold ${dark ? "text-grove-on-brand" : ""}`}>
        {spec.label}
        {dark ? " on a deep teal panel" : ""}
      </h3>
      <div className="flex flex-wrap items-start gap-6">
        <StateCell onDark={dark} caption="Default (live)">
          <Button variant={v}>{spec.label}</Button>
        </StateCell>
        <StateCell onDark={dark} caption="Hover">
          <Button variant={v} className={spec.hover} tabIndex={-1}>{spec.label}</Button>
        </StateCell>
        <StateCell onDark={dark} caption="Focus">
          <Button variant={v} className={FOCUS} tabIndex={-1}>{spec.label}</Button>
        </StateCell>
        <StateCell onDark={dark} caption="Pressed">
          <Button variant={v} className={spec.pressed} tabIndex={-1}>{spec.label}</Button>
        </StateCell>
        <StateCell onDark={dark} caption="Disabled">
          <Button variant={v} disabled>{spec.label}</Button>
        </StateCell>
        <StateCell onDark={dark} caption="Loading">
          <Button variant={v} loading>{spec.label}</Button>
        </StateCell>
      </div>
    </div>
  );
}

export function ComponentShowcase({ grove }: { grove: boolean }) {
  return (
    <>
      <section aria-labelledby="buttons" className="space-y-4">
        <h2 id="buttons" className="text-2xl font-semibold">Buttons</h2>
        {grove ? (
          <>
            <p className="text-sm text-grove-text-secondary">
              Minimum height 40 px (44 px on touch screens). Loading keeps the label, shows a spinner, reports
              aria-busy and ignores repeat clicks; it stays focusable. Disabled is 50% opacity and not focusable.
            </p>
            {GROVE_BUTTONS.map((b) => (
              <ButtonRow key={b.variant} spec={b} dark={b.variant === "grove-lime"} />
            ))}
          </>
        ) : null}
        <div className="rounded-grove-card border p-4">
          <h3 className="mb-3 text-sm font-semibold">Pre-Grove variant names (now resolved to the theme tokens)</h3>
          <div className="flex flex-wrap gap-3">
            <Button>Default</Button>
            <Button variant="gradient">Gradient</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="glass">Glass</Button>
            <Button variant="gradient" loading>Loading</Button>
          </div>
        </div>
      </section>

      {grove ? (
        <>
          <section aria-labelledby="chips" className="space-y-4">
            <h2 id="chips" className="text-2xl font-semibold">Status chips</h2>
            <p className="text-sm text-grove-text-secondary">
              Always text plus a glyph (check, exclamation, cross, info), never colour alone.
            </p>
            <div className="flex flex-wrap gap-3">
              <StatusChip tone="success">Completed</StatusChip>
              <StatusChip tone="warning">In review</StatusChip>
              <StatusChip tone="danger">Failed</StatusChip>
              <StatusChip tone="information">Guidance</StatusChip>
              <StatusChip tone="neutral">Draft</StatusChip>
            </div>
            <h3 className="text-[17px] font-semibold">Verification labels</h3>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(VERIFICATION_LABELS) as VerificationLabel[]).map((k) => (
                <VerificationChip key={k} label={k} />
              ))}
            </div>
            <h3 className="text-[17px] font-semibold">Pre-Grove Badge names (now resolved to state tokens)</h3>
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </section>

          <section aria-labelledby="cards" className="space-y-4">
            <h2 id="cards" className="text-2xl font-semibold">Cards</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card variant="grove">
                <CardHeader className="p-4 sm:p-5">
                  <CardTitle className="text-[17px] leading-6">Informational card</CardTitle>
                  <CardDescription className="text-grove-text-secondary dark:text-grove-text-secondary">
                    Not clickable and no hover state.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                  <StatusChip tone="success">Saved</StatusChip>
                </CardContent>
              </Card>
              <Card variant="grove-interactive">
                <CardHeader className="p-4 sm:p-5">
                  <CardTitle className="text-[17px] leading-6">
                    <CardMainLink href="#cards">Interactive card</CardMainLink>
                  </CardTitle>
                  <CardDescription className="text-grove-text-secondary dark:text-grove-text-secondary">
                    Hover tint, focus ring on its one main link, nested controls stay separate.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                  <Button variant="grove-secondary" className="relative z-10">Nested action</Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <section aria-labelledby="alerts" className="space-y-4">
            <h2 id="alerts" className="text-2xl font-semibold">Alerts</h2>
            <Alert variant="grove-information">
              <AlertTitle>Information</AlertTitle>
              <AlertDescription>Neutral guidance (status role).</AlertDescription>
            </Alert>
            <Alert variant="grove-success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Your changes were saved (status role).</AlertDescription>
            </Alert>
            <Alert variant="grove-warning" dismissible>
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>Needs attention. This one can be dismissed.</AlertDescription>
            </Alert>
            <Alert variant="grove-danger">
              <AlertTitle>Danger</AlertTitle>
              <AlertDescription>Something failed (alert role, announced immediately).</AlertDescription>
            </Alert>
          </section>
        </>
      ) : null}
    </>
  );
}
