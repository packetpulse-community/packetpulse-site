import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { SessionAwareLink } from "@/shared/auth/SessionAwareLink";

export function NetworkCta() {
  return (
    <section className="container py-20">
      <Reveal className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="pointer-events-none absolute inset-0 bg-primary/5" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-4 p-10 text-center">
          <h2 className="text-3xl font-semibold">Connect with the Network</h2>
          <p className="max-w-xl text-text-secondary">
            Real-time network diagnostics and visualization tools, built for members to explore and learn from.
          </p>
          <SessionAwareLink
            signedOut={{ href: "/login", label: "Sign In to Access Tools" }}
            signedIn={{ href: "/network-tools", label: "Open Network Tools" }}
            className={cn(buttonVariants({ variant: "default", size: "lg" }))}
            placeholderClassName="h-11 w-64"
          />
        </div>
      </Reveal>
    </section>
  );
}
