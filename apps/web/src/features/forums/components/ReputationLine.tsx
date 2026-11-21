import type { ForumReputation } from "@packetpulse/types";

// Reputation is text plus a number, never colour alone (Document 2 colour rule). The level word
// carries the meaning; the number is the evidence.
export function ReputationLine({ reputation, className }: { reputation?: ForumReputation; className?: string }) {
  if (!reputation) return null;
  return (
    <span className={className} data-testid="reputation">
      Reputation {reputation.points} · {reputation.level}
      {reputation.acceptedAnswers > 0 && ` · ${reputation.acceptedAnswers} accepted ${reputation.acceptedAnswers === 1 ? "answer" : "answers"}`}
    </span>
  );
}
