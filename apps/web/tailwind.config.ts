import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Base shadcn token system ported as-is from the old packetpulse-community frontend
// (packetpulse-community/tailwind.config.js) — but its actual visual identity
// (indigo/purple/cyan gradients, glassmorphism) lives in literal Tailwind utility
// classes throughout components, not in this token layer — see Button/Card/Badge
// primitives and the landing/auth pages for that recipe.
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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Signal Grove (opt-in theme, Document 2). Values come from
        // src/shared/styles/grove-tokens.css and only resolve inside
        // [data-theme="grove"]; never write raw hex in components.
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
