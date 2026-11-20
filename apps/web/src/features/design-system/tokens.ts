// Token catalogue shown on /design-system. Only names and CSS variable references:
// the values come from grove-tokens.css through getComputedStyle, never from here.

export interface ColourToken {
  name: string;
  cssVar: string;
  tailwind: string;
  use: string;
}

export interface TokenGroup {
  title: string;
  tokens: ColourToken[];
}

const t = (name: string, cssVar: string, tailwind: string, use: string): ColourToken => ({ name, cssVar, tailwind, use });

export const COLOUR_GROUPS: TokenGroup[] = [
  {
    title: "Surfaces and text",
    tokens: [
      t("Page background", "--grove-page", "bg-grove-page", "App background"),
      t("Surface", "--grove-surface", "bg-grove-surface", "Cards, forms, dialogs"),
      t("Surface subtle", "--grove-subtle", "bg-grove-subtle", "Selected rows, active navigation, tints"),
      t("Text primary", "--grove-text", "text-grove-text", "Headings and body"),
      t("Text secondary", "--grove-text-secondary", "text-grove-text-secondary", "Supporting text"),
      t("Border", "--grove-border", "border-grove-border", "Dividers, card outlines (decorative)"),
      t("Control border", "--grove-control", "border-grove-control", "Inputs, switches, checkboxes (3:1)"),
    ],
  },
  {
    title: "Brand, focus and actions",
    tokens: [
      t("Brand", "--grove-brand", "bg-grove-brand", "Primary buttons, active navigation"),
      t("Brand hover", "--grove-brand-hover", "bg-grove-brand-hover", "Primary hover"),
      t("Brand pressed", "--grove-brand-pressed", "bg-grove-brand-pressed", "Primary pressed"),
      t("Brand text", "--grove-brand-text", "text-grove-brand-text", "Links (derived: see commit note)"),
      t("On brand", "--grove-on-brand", "text-grove-on-brand", "Text on brand"),
      t("Focus ring", "--grove-focus", "ring-grove-focus", "3 px outline, 2 px offset"),
      t("Signal lime", "--grove-lime", "bg-grove-lime", "Reward moments, one action on dark"),
      t("Lime hover", "--grove-lime-hover", "bg-grove-lime-hover", "Lime hover"),
      t("Lime pressed", "--grove-lime-pressed", "bg-grove-lime-pressed", "Lime pressed"),
      t("On lime", "--grove-on-lime", "text-grove-on-lime", "Text on lime"),
      t("Deep teal", "--grove-teal", "bg-grove-teal", "Dark panels and hero backgrounds"),
      t("Deep teal raised", "--grove-teal-raised", "bg-grove-teal-raised", "Second deep teal"),
      t("Destructive", "--grove-destructive", "bg-grove-destructive", "Destructive button"),
      t("Destructive hover", "--grove-destructive-hover", "bg-grove-destructive-hover", "Hover"),
      t("Destructive pressed", "--grove-destructive-pressed", "bg-grove-destructive-pressed", "Pressed"),
      t("On destructive", "--grove-on-destructive", "text-grove-on-destructive", "Text on destructive"),
    ],
  },
  {
    title: "Module identities",
    tokens: [
      t("Community", "--module-community", "text-module-community", "Welcoming, credible"),
      t("Community soft", "--module-community-soft", "bg-module-community-soft", "Soft background"),
      t("Learning", "--module-learning", "text-module-learning", "Focus"),
      t("Learning soft", "--module-learning-soft", "bg-module-learning-soft", "Soft background"),
      t("Recruitment", "--module-recruitment", "text-module-recruitment", "Reliability"),
      t("Recruitment accent", "--module-recruitment-accent", "bg-module-recruitment-accent", "Accent"),
      t("Recruitment deep", "--module-recruitment-deep", "bg-module-recruitment-deep", "Deep"),
      t("Recruitment soft", "--module-recruitment-soft", "bg-module-recruitment-soft", "Soft background"),
      t("Payments", "--module-payments", "text-module-payments", "Value, care"),
      t("Payments soft", "--module-payments-soft", "bg-module-payments-soft", "Soft background"),
    ],
  },
  {
    title: "Semantic states",
    tokens: [
      t("Success", "--state-success", "text-state-success", "Completed, saved, passed, verified"),
      t("Success soft", "--state-success-soft", "bg-state-success-soft", "Background"),
      t("Warning", "--state-warning", "text-state-warning", "Needs attention, in review"),
      t("Warning soft", "--state-warning-soft", "bg-state-warning-soft", "Background"),
      t("Danger", "--state-danger", "text-state-danger", "Failed, invalid, destructive"),
      t("Danger soft", "--state-danger-soft", "bg-state-danger-soft", "Background"),
      t("Information", "--state-information", "text-state-information", "Neutral guidance"),
      t("Information soft", "--state-information-soft", "bg-state-information-soft", "Background"),
    ],
  },
];

export const RADII = [
  { name: "Tag", cssVar: "--grove-radius-tag", cls: "rounded-grove-tag", use: "6 px, tags" },
  { name: "Control", cssVar: "--grove-radius-control", cls: "rounded-grove-control", use: "10 px, buttons and inputs" },
  { name: "Card", cssVar: "--grove-radius-card", cls: "rounded-grove-card", use: "14 px, cards and dialogs" },
  { name: "Panel", cssVar: "--grove-radius-panel", cls: "rounded-grove-panel", use: "20 px, feature panels" },
  { name: "Pill", cssVar: "--grove-radius-pill", cls: "rounded-grove-pill", use: "chips" },
] as const;

export const SPACING = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;
