import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="container flex flex-col items-center gap-8 py-20 text-center md:py-28">
      <span className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
        Welcome to Packet Pulse Community
      </span>

      <h1 className="max-w-3xl bg-gradient-to-r from-foreground via-brand-muted to-foreground bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl">
        Connect, Learn &amp; Grow Together
      </h1>

      <p className="max-w-2xl text-lg text-muted-foreground">
        A thriving community of networking professionals. Learn, share, and grow your networking career alongside
        peers who've been there.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/register"
          className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90"
        >
          Join the Community
        </Link>
        <Link
          href="/resources"
          className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
        >
          Explore Resources
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">Join over 2000+ network professionals</p>

      <Image src="/hero-illustration.svg" alt="Network graph illustration" width={360} height={360} priority className="max-w-full" />
    </section>
  );
}
