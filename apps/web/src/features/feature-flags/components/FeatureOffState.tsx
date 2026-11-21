import Link from "next/link";
import { Power } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";

interface FeatureOffStateProps {
  /** What is off, in the member's words: "Forum posting". */
  feature: string;
  /** What they can still do: "You can still read every thread." */
  stillWorks?: string;
  /** Where to send them instead. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

// The friendly "this feature is off" state. It is not an error (nothing is broken and
// nothing the member did is wrong), so it is a status, not an alert: text plus a glyph.
export function FeatureOffState({ feature, stillWorks, backHref = "/", backLabel = "Back to home", className }: FeatureOffStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 rounded-grove-card border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <Power aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{feature} is switched off for now</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The team paused this on purpose. Nothing is wrong with your account. {stillWorks ?? "Please check back later."}
      </p>
      <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
        {backLabel}
      </Link>
    </div>
  );
}
