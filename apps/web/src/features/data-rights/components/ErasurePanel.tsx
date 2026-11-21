import { ERASURE_RULES, type DataRequestView, type ErasureOutcome } from "@packetpulse/types";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/primitives/Alert";
import { Button } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { erasureIsScheduled, erasureState, formatDate } from "../lib/data-rights-logic";

interface ErasurePanelProps {
  request: DataRequestView | null;
  graceDays: number;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}

const OUTCOME_HEADING: Record<ErasureOutcome, { title: string; blurb: string }> = {
  deleted: { title: "Deleted", blurb: "Removed for good." },
  anonymised: { title: "Kept without your name", blurb: "Others depend on it, so it stays and shows \"Deleted member\"." },
  kept: { title: "Kept for legal and safety reasons", blurb: "Proof records that hold no more than they must." },
};

// SCR-038 "Delete my account and data": the grace period, the password step (in the dialog) and
// the plain list of what is deleted, what stays and why.
export function ErasurePanel({ request, graceDays, busy, error, onStart, onCancel }: ErasurePanelProps) {
  const state = erasureState(request, graceDays);
  const scheduled = erasureIsScheduled(request);
  return (
    <Card id="delete" aria-labelledby="delete-title">
      <CardHeader>
        <CardTitle id="delete-title">Delete my account and data</CardTitle>
        <CardDescription>
          You confirm with your password. Your account is deactivated for {graceDays} days, during which you can cancel. After that your data is erased as listed below.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {scheduled && (
          <Alert variant="grove-warning">
            <AlertTitle>Deletion scheduled for {formatDate(request?.scheduledFor)}</AlertTitle>
            <AlertDescription>
              Your account is deactivated and you were signed out of other devices. Cancel now to keep your account exactly as it was.
            </AlertDescription>
          </Alert>
        )}
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={state.tone}>{state.label}</StatusChip>
          </div>
          <p className="text-sm">{state.text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {scheduled ? (
            <Button variant="secondary" onClick={onCancel} loading={busy}>
              Cancel the deletion
            </Button>
          ) : (
            <Button variant="destructive" onClick={onStart} disabled={busy}>
              Delete my account…
            </Button>
          )}
        </div>
        {error && (
          <p id="erasure-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {(["deleted", "anonymised", "kept"] as const).map((outcome) => (
            <section key={outcome} aria-labelledby={`outcome-${outcome}`}>
              <h3 id={`outcome-${outcome}`} className="font-medium">{OUTCOME_HEADING[outcome].title}</h3>
              <p className="text-sm text-text-secondary">{OUTCOME_HEADING[outcome].blurb}</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {ERASURE_RULES.filter((r) => r.outcome === outcome).map((r) => (
                  <li key={r.key}>
                    <span className="font-medium">{r.data}.</span> <span className="text-text-secondary">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
