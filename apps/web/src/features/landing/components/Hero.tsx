import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/shared/components/Reveal";

export function Hero() {
  return (
    <section className="container py-20 md:py-20">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal>
          <span className="mb-6 inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-sm font-medium text-indigo-300">
            Welcome to Packet Pulse Community
          </span>

          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-transparent xl:text-6xl">
            <span className="bg-gradient-to-r from-cyan-400 via-brand-muted to-purple-400 bg-clip-text">
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
            <Link
              href="/register"
              className="flex items-center justify-center rounded-md px-8 py-3 text-sm font-medium text-foreground transition-opacity hover:opacity-80"
            >
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
            <CheckCircle2 className="h-4 w-4 text-accent-teal" />
            Join over 2000+ network professionals
          </p>
        </Reveal>

        <Reveal delayMs={300} className="relative mx-auto w-full max-w-lg">
          <Image src="/hero-illustration.svg" alt="Network graph illustration" width={480} height={480} priority className="w-full" />
        </Reveal>
      </div>
    </section>
  );
}
