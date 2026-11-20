import Link from "next/link";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { cn } from "@/shared/utils/cn";

interface StatusScreenProps {
  icon: React.ReactNode;
  title: string;
  /** Plain-language explanation (what happened, why, what to do). */
  children: React.ReactNode;
  /** The ONE primary action (DES-008). */
  action: { label: string; href: string } | { label: string; onClick: () => void };
  /** Short code to quote to support. Never a message or stack. */
  reference?: string;
  /** Quiet extra links; they are secondary and never styled as buttons. */
  secondary?: React.ReactNode;
  /**
   * "page": renders its own <main id="main"> (outside any shell).
   * "embedded": renders inside a shell that already provides <main id="main">.
   */
  mode?: "page" | "embedded";
}

// One layout for every SCR-043 error screen so they share structure: one H1, one
// primary action, plain language, tokens only (works in both themes).
export function StatusScreen({ icon, title, children, action, reference, secondary, mode = "page" }: StatusScreenProps) {
  const Wrapper = mode === "page" ? "main" : "div";
  return (
    <Wrapper
      {...(mode === "page" ? { id: "main", tabIndex: -1 } : {})}
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-4 text-center",
        mode === "page" ? "min-h-screen justify-center py-16" : "py-16",
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-glass-border bg-glass text-muted-foreground"
      >
        {icon}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight outline-none" tabIndex={-1} data-page-heading>
        {title}
      </h1>
      <div className="text-muted-foreground">{children}</div>
      {"href" in action ? (
        <Link href={action.href} className={buttonVariants({ variant: "gradient" })}>
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} className={buttonVariants({ variant: "gradient" })}>
          {action.label}
        </button>
      )}
      {secondary && <div className="text-sm text-muted-foreground">{secondary}</div>}
      {reference && (
        <p className="text-xs text-muted-foreground">
          If this keeps happening, tell support this reference: <code className="font-mono text-foreground">{reference}</code>
        </p>
      )}
    </Wrapper>
  );
}
