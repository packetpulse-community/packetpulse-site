"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminDataRequestView } from "@packetpulse/types";
import { Button } from "@/shared/ui/primitives/Button";
import { EmptyState } from "@/shared/ui/primitives/EmptyState";
import { ErrorState } from "@/shared/ui/primitives/ErrorState";
import { Skeleton, SkeletonScreen } from "@/shared/ui/primitives/Skeleton";
import { StatusChip } from "@/shared/ui/primitives/StatusChip";
import { dataRightsApi, dataRightsKeys } from "../api/data-rights.api";
import { ADMIN_STATUS_LABEL, adminTone, auditLabel, formatDateTime } from "../lib/data-rights-logic";

// Read-only. Staff see that a request exists and where it stands; there is no button that opens,
// downloads or changes a request, and an export's contents are never loaded here.
export function AdminDataRequestsTable({ rows }: { rows: AdminDataRequestView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Data export and deletion requests</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-4 font-medium">Member</th>
            <th scope="col" className="py-2 pr-4 font-medium">Request</th>
            <th scope="col" className="py-2 pr-4 font-medium">Status</th>
            <th scope="col" className="py-2 pr-4 font-medium">Dates</th>
            <th scope="col" className="py-2 font-medium">Audit entries</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 align-top">
              <th scope="row" className="py-2 pr-4 font-normal">
                {r.user.erased ? <span>Deleted member</span> : <span>{r.user.firstName} {r.user.lastName}</span>}
                {!r.user.erased && <div className="text-xs text-text-secondary">{r.user.email}</div>}
              </th>
              <td className="py-2 pr-4">{r.kind === "export" ? "Data export" : "Account deletion"}</td>
              <td className="py-2 pr-4">
                <StatusChip tone={adminTone(r.status)}>{ADMIN_STATUS_LABEL[r.status]}</StatusChip>
              </td>
              <td className="py-2 pr-4 text-xs">
                <div>Requested {formatDateTime(r.requestedAt)}</div>
                {r.scheduledFor && <div>Erases {formatDateTime(r.scheduledFor)}</div>}
                {r.expiresAt && <div>Expires {formatDateTime(r.expiresAt)}</div>}
              </td>
              <td className="py-2 text-xs">
                {r.audit.length === 0 ? (
                  <span className="text-text-secondary">None</span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {r.audit.map((a, i) => (
                      <li key={`${a.action}-${i}`}>
                        {auditLabel(a.action)} <time dateTime={a.at}>{formatDateTime(a.at)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDataRequests() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const { data, isPending, isError, refetch } = useQuery({ queryKey: dataRightsKeys.admin(scope), queryFn: () => dataRightsApi.adminList(scope) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Which requests to list">
        <Button variant={scope === "open" ? "default" : "secondary"} size="sm" aria-pressed={scope === "open"} onClick={() => setScope("open")}>
          Open
        </Button>
        <Button variant={scope === "all" ? "default" : "secondary"} size="sm" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
          All
        </Button>
      </div>
      {isPending ? (
        <SkeletonScreen label="Loading data requests" className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </SkeletonScreen>
      ) : isError ? (
        <ErrorState title="We could not load the data requests." description="Check your connection and try again." retry={{ label: "Try again", onClick: () => void refetch() }} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title={scope === "open" ? "No open requests" : "No requests yet"}
          description="Export and deletion requests from members appear here with their audit entries."
          action={{ label: "Reload", onClick: () => void refetch() }}
        />
      ) : (
        <AdminDataRequestsTable rows={data.data} />
      )}
    </div>
  );
}
