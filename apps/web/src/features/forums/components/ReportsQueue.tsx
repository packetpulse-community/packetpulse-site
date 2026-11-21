"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FORUM_REPORT_REASON_LABELS, type ForumReportStatus } from "@packetpulse/types";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Card } from "@/shared/ui/primitives/Card";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { forumsClientApi } from "../api/forums.api";
import type { ForumReportRow } from "../api/forums.api";
import { ReasonDialog } from "./ReasonDialog";

export function ReportsQueue({ reports, status }: { reports: ForumReportRow[]; status: ForumReportStatus }) {
  const router = useRouter();
  const [deciding, setDeciding] = useState<{ report: ForumReportRow; action: "dismiss" | "remove" } | null>(null);

  if (reports.length === 0) {
    return <EmptyState title={status === "open" ? "No open reports" : `No ${status} reports`} description="Reports from members appear here for a moderator to decide." action={{ label: "Open the forum", href: "/forums" }} />;
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li key={r.id}>
            <Card variant="glass" className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {r.urgent && <Badge variant="danger">⚠ Urgent · 4 hour target</Badge>}
                {r.overdue && <Badge variant="warning">Overdue</Badge>}
                <Badge variant="outline">{FORUM_REPORT_REASON_LABELS[r.reason]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {r.kind === "thread" ? "Thread" : "Reply"} · reported by {r.reporter.firstName} {r.reporter.lastName} · answer by {new Date(r.acknowledgeBy).toLocaleString("en-IN")}
                </span>
              </div>
              {r.title && <p className="font-medium">{r.title}</p>}
              <p className="whitespace-pre-wrap text-sm">{r.contentRemoved ? "(already removed)" : r.excerpt}</p>
              {r.details && <p className="text-sm text-muted-foreground">Reporter said: {r.details}</p>}
              {r.threadId && (
                <Link href={`/forums/${r.threadId}`} className="w-fit text-sm underline">
                  Open the thread
                </Link>
              )}
              {status === "open" ? (
                <div className="flex gap-2">
                  <Button variant="glass" size="sm" onClick={() => setDeciding({ report: r, action: "dismiss" })}>
                    Dismiss
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeciding({ report: r, action: "remove" })}>
                    Remove post
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {status === "removed" ? "Removed" : "Dismissed"} by {r.resolvedBy ? `${r.resolvedBy.firstName} ${r.resolvedBy.lastName}` : "a moderator"}: {r.resolution}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {deciding && (
        <ReasonDialog
          open
          onClose={() => setDeciding(null)}
          title={deciding.action === "dismiss" ? "Dismiss this report" : "Remove the reported post"}
          description={deciding.action === "dismiss" ? "The post stays. Your reason is saved in the audit log." : "The post is hidden, its author is told your reason and loses the reputation it earned."}
          confirmLabel={deciding.action === "dismiss" ? "Dismiss" : "Remove post"}
          destructive={deciding.action === "remove"}
          onConfirm={async (reason) => {
            await (deciding.action === "dismiss" ? forumsClientApi.dismissReport(deciding.report.id, reason) : forumsClientApi.removeReported(deciding.report.id, reason));
            toast.success(deciding.action === "dismiss" ? "Report dismissed" : "Post removed");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
