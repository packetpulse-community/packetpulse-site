import Link from "next/link";
import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

export function FinalCta() {
  return (
    <section className="container py-20 text-center">
      <Reveal className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-semibold">Ready to get started?</h2>
        <p className="max-w-xl text-gray-300">Join thousands of network professionals who are already part of our community.</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/register" className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}>
            Create an Account
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-white/30 bg-white/5 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
          >
            Sign In
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
