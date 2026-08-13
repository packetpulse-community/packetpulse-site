import Link from "next/link";

export function NetworkCta() {
  return (
    <section className="container py-20">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-10 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--brand) / 0.25), transparent 40%), radial-gradient(circle at 80% 60%, hsl(var(--brand-muted) / 0.2), transparent 45%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <h2 className="text-3xl font-semibold">Connect with the Network</h2>
          <p className="max-w-xl text-muted-foreground">
            Real-time network diagnostics and visualization tools, built for members to explore and learn from.
          </p>
          <Link
            href="/login"
            className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Sign In to Access Tools
          </Link>
        </div>
      </div>
    </section>
  );
}
