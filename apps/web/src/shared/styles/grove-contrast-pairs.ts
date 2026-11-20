// The foreground/background token pairs the Grove theme promises to keep legible
// (Document 2 section 4.4). Shared by grove-contrast.test.ts and /design-system.
// Names are CSS variable names from grove-tokens.css.

export type ContrastKind = "text" | "control" | "focus";

export interface ContrastPair {
  name: string;
  fg: string;
  bg: string;
  kind: ContrastKind;
}

export const MIN_RATIO: Record<ContrastKind, number> = { text: 4.5, control: 3, focus: 3 };

const text = (name: string, fg: string, bg: string): ContrastPair => ({ name, fg, bg, kind: "text" });

const STATES = ["success", "warning", "danger", "information"] as const;
const MODULES = ["community", "learning", "recruitment", "payments"] as const;

export const CONTRAST_PAIRS: ContrastPair[] = [
  text("Text primary on page", "--grove-text", "--grove-page"),
  text("Text primary on surface", "--grove-text", "--grove-surface"),
  text("Text primary on surface subtle", "--grove-text", "--grove-subtle"),
  text("Text secondary on page", "--grove-text-secondary", "--grove-page"),
  text("Text secondary on surface", "--grove-text-secondary", "--grove-surface"),
  text("Text secondary on surface subtle", "--grove-text-secondary", "--grove-subtle"),
  text("Brand text (links) on surface", "--grove-brand-text", "--grove-surface"),
  text("Brand text (links) on page", "--grove-brand-text", "--grove-page"),
  text("On-brand on brand", "--grove-on-brand", "--grove-brand"),
  text("On-brand on brand hover", "--grove-on-brand", "--grove-brand-hover"),
  text("On-brand on brand pressed", "--grove-on-brand", "--grove-brand-pressed"),
  text("On-lime on lime", "--grove-on-lime", "--grove-lime"),
  text("On-lime on lime hover", "--grove-on-lime", "--grove-lime-hover"),
  text("On-lime on lime pressed", "--grove-on-lime", "--grove-lime-pressed"),
  text("Lime on deep teal", "--grove-lime", "--grove-teal"),
  text("On-destructive on destructive", "--grove-on-destructive", "--grove-destructive"),
  text("On-destructive on destructive hover", "--grove-on-destructive", "--grove-destructive-hover"),
  text("On-destructive on destructive pressed", "--grove-on-destructive", "--grove-destructive-pressed"),
  ...STATES.flatMap((s) => [
    text(`State ${s} text on soft`, `--state-${s}`, `--state-${s}-soft`),
    text(`State ${s} text on surface`, `--state-${s}`, "--grove-surface"),
  ]),
  ...MODULES.flatMap((m) => [
    text(`Module ${m} on soft`, `--module-${m}`, `--module-${m}-soft`),
    text(`Module ${m} on surface`, `--module-${m}`, "--grove-surface"),
  ]),
  { name: "Control border on surface", fg: "--grove-control", bg: "--grove-surface", kind: "control" },
  { name: "Control border on page", fg: "--grove-control", bg: "--grove-page", kind: "control" },
  { name: "Focus ring on surface", fg: "--grove-focus", bg: "--grove-surface", kind: "focus" },
  { name: "Focus ring on page", fg: "--grove-focus", bg: "--grove-page", kind: "focus" },
];
