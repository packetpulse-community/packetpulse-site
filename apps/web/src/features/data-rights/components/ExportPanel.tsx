import { Download } from "lucide-react";
import type { DataRequestView } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { FeatureOffState } from "@/features/feature-flags/components/FeatureOffState";
import { exportIsOpen, exportIsWorking, exportState, formatDateTime } from "../lib/data-rights-logic";

interface ExportPanelProps {
  request: DataRequestView | null;
  /** The data_rights.export switch. Off: no new request, an existing ready export stays downloadable. */
  enabled: boolean;
  availableDays: number;
  busy: "request" | "download" | "discard" | null;
  error: string | null;
  onRequest: () => void;
  onDownload: () => void;
  onDiscard: () => void;
}

// SCR-038 "Download my data". The state is always written in words next to the chip; the
// preparing state is a live region so a screen-reader user hears it finish.
export function ExportPanel({ request, enabled, availableDays, busy, error, onRequest, onDownload, onDiscard }: ExportPanelProps) {
  const state = exportState(request, availableDays);
  const open = exportIsOpen(request);
  const ready = request?.status === "ready";
  return (
    <Card id="export" aria-labelledby="export-title">
      <CardHeader>
        <CardTitle id="export-title">Download my data</CardTitle>
        <CardDescription>
          A zip of JSON files with your profile, consents, skills, forum and blog content, quiz results, notification settings and file details. It never includes anyone else&apos;s data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!enabled && !ready ? (
          <FeatureOffState
            feature="Data export"
            stillWorks="You can still delete your account, and anything already prepared stays available."
            backHref="/profile"
            backLabel="Back to your profile"
          />
        ) : (
          <>
            <div role="status" aria-live="polite" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={state.tone}>{state.label}</StatusChip>
                {request && <span className="text-xs text-text-secondary">Requested {formatDateTime(request.requestedAt)}</span>}
              </div>
              <p className="text-sm">{state.text}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {ready && (
                <Button onClick={onDownload} loading={busy === "download"} disabled={busy !== null}>
                  <Download aria-hidden="true" className="h-4 w-4" />
                  Download my data
                </Button>
              )}
              {!open && (
                <Button variant={request ? "secondary" : "default"} onClick={onRequest} loading={busy === "request"} disabled={busy !== null || !enabled}>
                  {request ? "Request a new export" : "Request my data"}
                </Button>
              )}
              {(ready || exportIsWorking(request)) && (
                <Button variant="secondary" onClick={onDiscard} loading={busy === "discard"} disabled={busy !== null}>
                  {ready ? "Discard this export" : "Cancel this request"}
                </Button>
              )}
            </div>
          </>
        )}
        {error && (
          <p id="export-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-text-secondary">
          We will email you when it is ready. The email links to this page; the file itself is never sent by email, and each download link works for a few minutes only.
        </p>
      </CardContent>
    </Card>
  );
}
