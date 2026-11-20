import { Reveal } from "@/shared/components/Reveal";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { SessionAwareLink } from "@/shared/auth/SessionAwareLink";

export function FinalCta() {
  return (
    <section className="container py-20 text-center">
      <Reveal className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-semibold">Ready to get started?</h2>
        <p className="max-w-xl text-gray-300">Join thousands of network professionals who are already part of our community.</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <SessionAwareLink
            signedOut={{ href: "/register", label: "Create an Account" }}
            signedIn={{ href: "/dashboard", label: "Go to dashboard" }}
            className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}
            placeholderClassName="h-11 w-48"
          />
          <SessionAwareLink
            signedOut={{ href: "/login", label: "Sign In" }}
            signedIn={null}
            className="rounded-md glass-panel glass-interactive px-6 py-3 text-sm font-medium text-foreground"
            placeholderClassName="h-11 w-28"
          />
        </div>
      </Reveal>
    </section>
  );
}
