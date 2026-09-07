import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

export function Hero() {
  return (
    <section className="container relative overflow-hidden py-20 md:py-20">
      {/* Decorative blurred blobs + animated gradient lines, ported from the
          reference project's hero (staggered ambient glow behind the content). */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-[10%] top-10 h-72 w-72 animate-pulse rounded-full bg-indigo-500 opacity-20 blur-3xl" />
        <div
          className="absolute right-[15%] top-32 h-64 w-64 animate-pulse rounded-full bg-purple-500 opacity-20 blur-3xl"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-10 left-[30%] h-56 w-56 animate-pulse rounded-full bg-cyan-400 opacity-10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute bottom-0 right-[10%] h-48 w-48 animate-pulse rounded-full bg-blue-400 opacity-10 blur-3xl"
          style={{ animationDelay: "1.5s" }}
        />
        <div className="absolute left-0 top-1/4 h-px w-1/3 animate-pulse bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
        <div
          className="absolute right-0 top-1/2 h-px w-1/4 animate-pulse bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 h-px w-1/3 animate-pulse bg-gradient-to-r from-transparent via-purple-400 to-transparent"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal immediate>
          <span className="mb-6 inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-300">
            Welcome to Packet Pulse Community
          </span>

          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-transparent xl:text-6xl">
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text">
              Connect, Learn &amp;
              <br />
              Grow Together
            </span>
          </h1>

          <p className="mb-8 max-w-xl text-lg text-gray-300 md:text-xl">
            A thriving community of networking professionals. Learn, share &amp; grow your networking career with
            expert resources and peer support.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/register" className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}>
              Join the Community
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/resources"
              className="flex items-center justify-center rounded-md border border-foreground/30 bg-foreground/5 px-8 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
            >
              Explore Resources
            </Link>
          </div>

          <p className="mt-8 flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            Join over 2000+ network professionals
          </p>
        </Reveal>

        <Reveal immediate delayMs={300}>
          <div className="relative mx-auto aspect-square w-full max-w-lg">
            {/* Pulsing gradient rings + circular glass-framed illustration + floating
                frosted accent shapes — ported verbatim from the reference site's hero
                (verified against its production JS bundle, not just local source). */}
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20" />
            <div
              className="absolute inset-4 animate-pulse rounded-full bg-gradient-to-br from-indigo-600/40 to-purple-600/40"
              style={{ animationDelay: "1s" }}
            />
            <div className="absolute inset-8 overflow-hidden rounded-full glass-panel shadow-glass-glow">
              <Image
                src="/hero-illustration.svg"
                alt="Network graph illustration"
                fill
                priority
                className="object-cover"
              />
            </div>
            <div className="absolute right-8 top-0 h-16 w-16 animate-float rounded-xl bg-cyan-400/80 backdrop-blur-md" style={{ transform: "rotate(12deg)" }} />
            <div
              className="absolute -left-8 bottom-12 h-20 w-20 animate-float rounded-xl bg-indigo-500/80 backdrop-blur-md"
              style={{ transform: "rotate(-12deg)", animationDelay: "1s" }}
            />
            <div
              className="absolute bottom-4 right-4 h-12 w-12 animate-float rounded-full bg-purple-500/80 backdrop-blur-md"
              style={{ animationDelay: "2s" }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
