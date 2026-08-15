import Link from "next/link";
import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

export function NetworkCta() {
  return (
    <section className="container py-20">
      <Reveal className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-900/30">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(147, 51, 234, 0.2), transparent 45%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-4 p-10 text-center">
          <h2 className="text-3xl font-semibold">Connect with the Network</h2>
          <p className="max-w-xl text-gray-300">
            Real-time network diagnostics and visualization tools, built for members to explore and learn from.
          </p>
          <Link href="/login" className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}>
            Sign In to Access Tools
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
