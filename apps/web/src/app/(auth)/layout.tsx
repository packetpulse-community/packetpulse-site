// Indigo/purple/blue dark gradient — ported from the old AuthLayout treatment (plan §6).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-card-foreground shadow-xl">
        {children}
      </div>
    </div>
  );
}
