// The reference marketing site's whole page sits on one continuous vertical
// gradient (slate-900 -> indigo-950 -> indigo-900), not the app's flat
// --background token — sections have no dividing borders/backgrounds of their
// own, they just flow on this gradient. Scoped to the public marketing pages
// (home, about) only, not the root layout — the authenticated app keeps its
// existing flat dark theme untouched.
export function MarketingBackground({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-indigo-900 text-foreground">{children}</div>;
}
