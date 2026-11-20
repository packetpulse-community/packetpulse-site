import { AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { StateActionButton, type StateAction } from "./EmptyState";

interface ErrorStateProps {
  /** What happened: "We could not load the resources." */
  title: string;
  /** Why, and how to fix it (section 11.1). No blame, no technical detail. */
  description: string;
  /**
   * Retry. Pass `onClick` for client lists (react-query: refetch) or an `href`
   * equal to the current URL for server pages, so the filters in the query
   * string are kept (Document 2 section 10: failed loads keep filters).
   */
  retry: StateAction;
  className?: string;
}

// Shared inline error for a failed list or form load. role="alert" so it is
// announced; text plus a glyph, never colour alone (DES-007).
export function ErrorState({ title, description, retry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "col-span-full flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="h-8 w-8" />
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-md text-sm">{description}</p>
      <StateActionButton action={retry} variant="outline" />
    </div>
  );
}
