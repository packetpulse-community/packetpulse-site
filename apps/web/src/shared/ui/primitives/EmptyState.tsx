import Link from "next/link";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "./Button";

export type StateAction = { label: string; href: string } | { label: string; onClick: () => void };

export function StateActionButton({ action, variant = "gradient" }: { action: StateAction; variant?: "gradient" | "outline" }) {
  return "href" in action ? (
    <Link href={action.href} className={buttonVariants({ variant })}>
      {action.label}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={buttonVariants({ variant })}>
      {action.label}
    </button>
  );
}

interface EmptyStateProps {
  /** What this is: "No resources yet." */
  title: string;
  /** Why it is empty and how to start (Document 2 section 11.1). */
  description: string;
  /** The ONE next action (DES-009: every empty state offers an action). */
  action: StateAction;
  /** At most one small line icon (section 9); decorative, so hidden from assistive technology. */
  icon?: React.ReactNode;
  /** Heading level for the title; pages already own the H1. */
  as?: "h2" | "h3";
  className?: string;
}

// Shared empty state. Zero results after a search or filter should say what was
// searched and offer "Clear filters" as the action (section 12); first-use empty
// states say what the list is for and how to add the first item.
export function EmptyState({ title, description, action, icon, as: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "col-span-full flex flex-col items-center gap-3 rounded-grove-card border border-border bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div aria-hidden="true" className="text-muted-foreground [&>svg]:h-8 [&>svg]:w-8">
          {icon}
        </div>
      )}
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <StateActionButton action={action} />
    </div>
  );
}
