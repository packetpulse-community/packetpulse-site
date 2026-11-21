import { Check, X } from "lucide-react";
import type { ResumeSuggestionView } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { describeSuggestion, groupSuggestions, KIND_HEADINGS, pendingCount } from "../lib/resume-logic";

interface SuggestionReviewProps {
  suggestions: ResumeSuggestionView[];
  /** Suggestion currently being saved. */
  busyId: string | null;
  /** Inline error per suggestion (for example the 25-skill limit). */
  errors: Record<string, string>;
  onDecide: (id: string, decision: "accept" | "reject") => void;
}

// Review, field by field (PRD-007: nothing is saved until confirmed). Every row says in words what
// it is and what happened to it; the buttons name the value they act on.
export function SuggestionReview({ suggestions, busyId, errors, onDecide }: SuggestionReviewProps) {
  const groups = groupSuggestions(suggestions);
  const pending = pendingCount(suggestions);
  if (suggestions.length === 0) {
    return (
      <p className="text-sm">
        We did not find anything to suggest. You can add your skills and details by hand; that works whether or not we could read your resume.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <p role="status" aria-live="polite" className="text-sm">
        {pending === 0 ? "You have reviewed everything we found." : `${pending} ${pending === 1 ? "suggestion is" : "suggestions are"} waiting for you. Nothing is added to your profile until you accept it.`}
      </p>
      {(["skill", "education", "experience"] as const).map((kind) =>
        groups[kind].length === 0 ? null : (
          <section key={kind} aria-labelledby={`suggest-${kind}`}>
            <h3 id={`suggest-${kind}`} className="font-medium">
              {KIND_HEADINGS[kind]}
            </h3>
            <ul className="mt-2 flex flex-col divide-y divide-border rounded-grove-card border border-border">
              {groups[kind].map((s) => {
                const { title, detail } = describeSuggestion(s);
                const busy = busyId === s.id;
                const errorId = `suggest-error-${s.id}`;
                return (
                  <li key={s.id} className="flex flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium">{title}</p>
                        {detail && <p className="break-words text-sm text-text-secondary">{detail}</p>}
                      </div>
                      {s.status === "accepted" && <StatusChip tone="success">On your profile</StatusChip>}
                      {s.status === "rejected" && <StatusChip tone="neutral">Not added</StatusChip>}
                      {s.status !== "accepted" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => onDecide(s.id, "accept")} loading={busy} disabled={busyId !== null} aria-label={`Accept ${title}`} aria-describedby={errors[s.id] ? errorId : undefined}>
                            <Check aria-hidden="true" className="h-4 w-4" />
                            Accept
                          </Button>
                          {s.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => onDecide(s.id, "reject")} disabled={busyId !== null} aria-label={`Reject ${title}`}>
                              <X aria-hidden="true" className="h-4 w-4" />
                              Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {errors[s.id] && (
                      <p id={errorId} role="alert" className="text-sm text-danger">
                        {errors[s.id]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}
