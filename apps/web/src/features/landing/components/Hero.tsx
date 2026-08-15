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

        <Reveal immediate delayMs={300} className="relative mx-auto w-full max-w-lg">
          <div className="animate-float">
            <Image src="/hero-illustration.svg" alt="Network graph illustration" width={480} height={480} priority className="w-full" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
