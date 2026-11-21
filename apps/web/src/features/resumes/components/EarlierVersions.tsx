import type { ResumeView } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { formatBytes, formatUploaded, resumeState } from "../lib/resume-logic";

interface Props {
  versions: ResumeView[];
  busyId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

// Version history: the resumes this one replaced.
export function EarlierVersions({ versions, busyId, onOpen, onDelete }: Props) {
  if (versions.length === 0) return <p className="text-sm text-text-secondary">When you replace your resume, the earlier versions are listed here.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-grove-card border border-border">
      {versions.map((v) => {
        const state = resumeState(v);
        return (
          <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">
                Version {v.version}: {v.originalName}
              </p>
              <p className="text-sm text-text-secondary">
                {formatBytes(v.sizeBytes)} · uploaded {formatUploaded(v.createdAt)}
              </p>
            </div>
            <StatusChip tone={state.tone}>{state.label}</StatusChip>
            <div className="flex gap-2">
              {v.status !== "rejected" && (
                <Button size="sm" variant="secondary" onClick={() => onOpen(v.id)} loading={busyId === v.id} disabled={busyId !== null} aria-label={`Open version ${v.version}`}>
                  Open
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onDelete(v.id)} disabled={busyId !== null} aria-label={`Delete version ${v.version}`}>
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
