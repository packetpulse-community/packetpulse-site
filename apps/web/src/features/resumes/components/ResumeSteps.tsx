import { Check, Circle, Loader2, X } from "lucide-react";
import { resumeSteps, STEP_STATE_TEXT, type UploadPhase } from "../lib/resume-logic";
import type { ResumeView } from "@packetpulse/types";

// Upload, check, read, review as an ordered list. Each step says its state in words
// (done, in progress, not started, stopped); the glyph only repeats it.
export function ResumeSteps({ phase, current }: { phase: UploadPhase; current: ResumeView | null }) {
  const steps = resumeSteps(phase, current);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Resume progress">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5" aria-current={s.state === "current" ? "step" : undefined}>
          {s.state === "done" && <Check aria-hidden="true" className="h-4 w-4 text-state-success" />}
          {s.state === "current" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-state-information motion-reduce:animate-none" />}
          {s.state === "todo" && <Circle aria-hidden="true" className="h-4 w-4 text-text-secondary" />}
          {s.state === "failed" && <X aria-hidden="true" className="h-4 w-4 text-state-danger" />}
          <span className={s.state === "todo" ? "text-text-secondary" : "font-medium"}>{s.label}</span>
          <span className="text-text-secondary">({STEP_STATE_TEXT[s.state]})</span>
        </li>
      ))}
    </ol>
  );
}
