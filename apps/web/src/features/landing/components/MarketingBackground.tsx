// Page frame for the public pages (home, about, blogs, tools): the Grove page colour, a column
// that lets the footer sit at the bottom, and nothing else. The old indigo gradient is gone; pages
// that still use hard-coded dark glass classes are put on the dark tokens by the legacy scope
// (shared/theme/LegacyScope.tsx, routes listed in shared/theme/legacy-routes.ts), so this frame
// follows whichever tokens are active.
export function MarketingBackground({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col overflow-hidden bg-background text-foreground">{children}</div>;
}
