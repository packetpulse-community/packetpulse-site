import Link from "next/link";

export function FinalCta() {
  return (
    <section className="border-t border-border bg-card/40">
      <div className="container flex flex-col items-center gap-6 py-20 text-center">
        <h2 className="text-3xl font-semibold">Ready to get started?</h2>
        <p className="max-w-xl text-muted-foreground">Join thousands of network professionals who are already part of our community.</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
          >
            Create an Account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
