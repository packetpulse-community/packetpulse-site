// The reference marketing site's whole page sits on one continuous vertical
// gradient (slate-900 -> indigo-950 -> indigo-900), not the app's flat
// --background token — sections have no dividing borders/backgrounds of their
// own, they just flow on this gradient. Scoped to the public marketing pages
// (home, about) only, not the root layout — the authenticated app keeps its
// existing flat dark theme untouched.
//
// Light variant (slate-50 -> indigo-50 -> white) mirrors the same
// neutral-tinted-neutral structure at light-mode luminance — glass panels
// need a wash with contrast behind them, a flat white page would make them
// nearly invisible. The app is dark-only for now (no theme toggle exists
// yet), but these tokens keep light mode ready to switch on.
export function MarketingBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-indigo-50 to-white text-foreground dark:from-slate-900 dark:via-indigo-950 dark:to-indigo-900">
      {children}
    </div>
  );
}
