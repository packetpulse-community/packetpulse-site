import type { ProfileEntries } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { formatMonth } from "../lib/resume-logic";

interface Props {
  entries: ProfileEntries;
  busyId: string | null;
  error: string | null;
  onRemove: (kind: "education" | "experience", id: string) => void;
}

// What the member accepted from a resume, with a way to take it off again.
export function ProfileEntriesPanel({ entries, busyId, error, onRemove }: Props) {
  const empty = entries.education.length === 0 && entries.experience.length === 0;
  if (empty) return <p className="text-sm text-text-secondary">Education and experience you accept from a resume will be listed here.</p>;
  const range = (a: string, b: string) => [a, b].filter(Boolean).join(" to ");
  return (
    <div className="flex flex-col gap-4">
      {entries.education.length > 0 && (
        <section aria-labelledby="entries-education">
          <h3 id="entries-education" className="font-medium">Education</h3>
          <ul className="mt-2 flex flex-col divide-y divide-border rounded-grove-card border border-border">
            {entries.education.map((e) => {
              const title = e.qualification ?? e.institution ?? "Education";
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{title}</p>
                    <p className="break-words text-sm text-text-secondary">{[e.qualification ? e.institution : null, range(e.startYear ? String(e.startYear) : "", e.endYear ? String(e.endYear) : "")].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onRemove("education", e.id)} loading={busyId === e.id} disabled={busyId !== null} aria-label={`Remove ${title} from my profile`}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {entries.experience.length > 0 && (
        <section aria-labelledby="entries-experience">
          <h3 id="entries-experience" className="font-medium">Experience</h3>
          <ul className="mt-2 flex flex-col divide-y divide-border rounded-grove-card border border-border">
            {entries.experience.map((e) => {
              const title = e.title && e.company ? `${e.title} at ${e.company}` : (e.title ?? e.company ?? "Experience");
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{title}</p>
                    <p className="text-sm text-text-secondary">{range(formatMonth(e.startDate), e.current ? "present" : formatMonth(e.endDate))}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onRemove("experience", e.id)} loading={busyId === e.id} disabled={busyId !== null} aria-label={`Remove ${title} from my profile`}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
