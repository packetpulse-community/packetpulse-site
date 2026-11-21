import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { SessionAwareLink } from "@/shared/auth/SessionAwareLink";

export function Hero() {
  return (
    <section className="container relative overflow-hidden py-20 md:py-20">
      {/* Decorative ambient glow: brand-tinted, token-based, hidden from assistive tech. */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-[10%] top-10 h-72 w-72 rounded-full bg-primary opacity-10 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute bottom-10 right-[15%] h-56 w-56 rounded-full bg-accent opacity-20 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute left-0 top-1/4 h-px w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent opacity-40" />
      </div>

      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal immediate>
          <span className="mb-6 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-text">
            Welcome to Packet Pulse Community
          </span>

          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-text xl:text-6xl">
            <span>
              Connect, Learn &amp;
              <br />
              Grow Together
            </span>
          </h1>

          <p className="mb-8 max-w-xl text-lg text-text-secondary md:text-xl">
            A thriving community of networking professionals. Learn, share &amp; grow your networking career with
            expert resources and peer support.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <SessionAwareLink
              signedOut={{ href: "/register", label: "Join the Community" }}
              signedIn={{ href: "/dashboard", label: "Go to dashboard" }}
              trailingIcon={<ArrowRight className="ml-2 h-4 w-4" />}
              className={cn(buttonVariants({ variant: "default", size: "lg" }))}
              placeholderClassName="h-11 w-60"
            />
            <Link
              href="/resources"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Explore Resources
            </Link>
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-text-secondary">
            <CheckCircle2 className="h-4 w-4 text-primary-text" />
            Join over 2000+ network professionals
          </p>
        </Reveal>

        <Reveal immediate delayMs={300}>
          <div className="relative mx-auto aspect-square w-full max-w-lg">
            <div className="absolute inset-0 rounded-full bg-primary/10 motion-safe:animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-primary/10" />
            <div className="absolute inset-8 overflow-hidden rounded-full border border-border bg-surface">
              <Image
                src="/hero-illustration.svg"
                alt="Network graph illustration"
                fill
                priority
                className="object-cover"
              />
            </div>
            <div className="absolute right-8 top-0 h-16 w-16 rotate-12 rounded-xl bg-accent motion-safe:animate-float" aria-hidden="true" />
            <div className="absolute -left-2 bottom-12 h-20 w-20 -rotate-12 rounded-xl bg-primary opacity-80 motion-safe:animate-float" aria-hidden="true" />
            <div className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-accent opacity-70 motion-safe:animate-float" aria-hidden="true" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
