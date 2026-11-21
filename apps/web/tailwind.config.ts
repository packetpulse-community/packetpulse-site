import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Colour model: Signal Grove (Document 2) is the default theme. Every semantic name below
// resolves to a CSS variable from src/shared/styles/grove-tokens.css, which holds the light
// values on :root and the dark values on `.dark`. Never write raw hex in components.
//
// Semantic names for screens: background, surface(.subtle), border(.control), text(.secondary),
// primary(.hover/.pressed/.text/.foreground), accent (lime), success, warning, danger, info
// (each with .soft). The shadcn names (foreground, muted, card, popover, secondary,
// destructive, input, ring) stay as aliases so older components keep working.
//
// Colours are functions so opacity modifiers work (bg-primary/10) on var() based values.
// Typed as string because Tailwind's config types do not model the function form it accepts.
const v = (name: string): string =>
  (({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined || opacityValue === "1"
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`) as unknown as string;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // `--grove-destructive` is a button FILL (#b42332 in both themes): as text on the dark page it is only
      // 2.4:1. Every `text-destructive` on a page background should use the state token, which is the same
      // red in Light and a readable pink in Dark (a11y scan, TASK-050). Fills and borders keep `destructive`.
      textColor: { destructive: v("--state-danger") },
      colors: {
        // --- semantic names (use these in new and migrated code) ---
        background: v("--grove-page"),
        surface: { DEFAULT: v("--grove-surface"), subtle: v("--grove-subtle") },
        border: v("--grove-border"),
        control: v("--grove-control"),
        text: { DEFAULT: v("--grove-text"), secondary: v("--grove-text-secondary") },
        primary: {
          DEFAULT: v("--grove-brand"),
          hover: v("--grove-brand-hover"),
          pressed: v("--grove-brand-pressed"),
          text: v("--grove-brand-text"),
          foreground: v("--grove-on-brand"),
        },
        accent: {
          DEFAULT: v("--grove-lime"),
          hover: v("--grove-lime-hover"),
          pressed: v("--grove-lime-pressed"),
          foreground: v("--grove-on-lime"),
        },
        success: { DEFAULT: v("--state-success"), soft: v("--state-success-soft") },
        warning: { DEFAULT: v("--state-warning"), soft: v("--state-warning-soft") },
        danger: { DEFAULT: v("--state-danger"), soft: v("--state-danger-soft") },
        info: { DEFAULT: v("--state-information"), soft: v("--state-information-soft") },
        // --- shadcn aliases kept so existing components resolve to the Grove values ---
        foreground: v("--grove-text"),
        input: v("--grove-control"),
        ring: v("--grove-focus"),
        secondary: { DEFAULT: v("--grove-subtle"), foreground: v("--grove-text") },
        destructive: { DEFAULT: v("--grove-destructive"), foreground: v("--grove-on-destructive") },
        muted: { DEFAULT: v("--grove-subtle"), foreground: v("--grove-text-secondary") },
        popover: { DEFAULT: v("--grove-surface"), foreground: v("--grove-text") },
        card: { DEFAULT: v("--grove-surface"), foreground: v("--grove-text") },
        grove: {
          page: "var(--grove-page)",
          surface: "var(--grove-surface)",
          subtle: "var(--grove-subtle)",
          text: "var(--grove-text)",
          "text-secondary": "var(--grove-text-secondary)",
          border: "var(--grove-border)",
          control: "var(--grove-control)",
          brand: "var(--grove-brand)",
          "brand-hover": "var(--grove-brand-hover)",
          "brand-pressed": "var(--grove-brand-pressed)",
          "brand-text": "var(--grove-brand-text)",
          "on-brand": "var(--grove-on-brand)",
          focus: "var(--grove-focus)",
          lime: "var(--grove-lime)",
          "lime-hover": "var(--grove-lime-hover)",
          "lime-pressed": "var(--grove-lime-pressed)",
          "on-lime": "var(--grove-on-lime)",
          teal: "var(--grove-teal)",
          "teal-raised": "var(--grove-teal-raised)",
          destructive: "var(--grove-destructive)",
          "destructive-hover": "var(--grove-destructive-hover)",
          "destructive-pressed": "var(--grove-destructive-pressed)",
          "on-destructive": "var(--grove-on-destructive)",
          scrim: "var(--grove-scrim)",
        },
        "module-community": { DEFAULT: "var(--module-community)", soft: "var(--module-community-soft)" },
        "module-learning": { DEFAULT: "var(--module-learning)", soft: "var(--module-learning-soft)" },
        "module-recruitment": {
          DEFAULT: "var(--module-recruitment)",
          accent: "var(--module-recruitment-accent)",
          deep: "var(--module-recruitment-deep)",
          soft: "var(--module-recruitment-soft)",
        },
        "module-payments": { DEFAULT: "var(--module-payments)", soft: "var(--module-payments-soft)" },
        "state-success": { DEFAULT: "var(--state-success)", soft: "var(--state-success-soft)" },
        "state-warning": { DEFAULT: "var(--state-warning)", soft: "var(--state-warning-soft)" },
        "state-danger": { DEFAULT: "var(--state-danger)", soft: "var(--state-danger-soft)" },
        "state-information": { DEFAULT: "var(--state-information)", soft: "var(--state-information-soft)" },
        glass: {
          DEFAULT: "var(--glass-surface)",
          strong: "var(--glass-surface-strong)",
          border: "var(--glass-border-color)",
        },
      },
      borderRadius: {
        "grove-tag": "var(--grove-radius-tag)",
        "grove-control": "var(--grove-radius-control)",
        "grove-card": "var(--grove-radius-card)",
        "grove-panel": "var(--grove-radius-panel)",
        "grove-pill": "var(--grove-radius-pill)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
        "glass-strong": "var(--glass-blur-strong)",
      },
      boxShadow: {
        "grove-overlay": "var(--grove-shadow-overlay)",
        glass: "var(--glass-shadow)",
        "glass-glow": "var(--glass-glow)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Grove stacks (names only; no font file is downloaded).
        "grove-sans": [
          "var(--grove-font-sans, Inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        "grove-mono": ["var(--grove-font-mono, ui-monospace)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Real implementation of the reference project's `animate-float` — it
        // references this class on decorative hero blobs but never defines the
        // keyframe itself (dead class there); this is a working gentle bob.
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
